/************************************************************
 * Code.gs
 * ระบบติดตามและรายงานผลโครงการ
 *
 * รองรับ 2 โหมด
 * 1) /exec        = หน้า Web App
 * 2) /exec?api=1  = JSON API สำหรับ Next.js
 ************************************************************/

const APP_NAME = 'ระบบติดตามและรายงานผลโครงการ';

const SHEETS = {
  USERS: 'Users',
  PROJECTS: 'Projects',
  REPORTS: 'ProgressReports',
  EVIDENCE: 'Evidence',
  TARGETS: 'ReportTargets',
  REVIEWS: 'ReviewLogs',
  MASTER: 'MasterData'
};


/* =========================================================
   WEB APP
========================================================= */

function doGet(e) {

  try {

    // -----------------------------------------
    // JSON API
    // URL: /exec?api=1
    // -----------------------------------------
    if (
      e &&
      e.parameter &&
      String(e.parameter.api) === '1'
    ) {

      const data = getApiData_();

      return jsonResponse_({
        success: true,
        message: 'เชื่อมต่อ Apps Script สำเร็จ',
        timestamp: new Date().toISOString(),
        data: data
      });
    }


    // -----------------------------------------
    // หน้า Web App ปกติ
    // -----------------------------------------
    return HtmlService
      .createTemplateFromFile('index')
      .evaluate()
      .setTitle(APP_NAME)
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.ALLOWALL
      )
      .addMetaTag(
        'viewport',
        'width=device-width, initial-scale=1'
      );

  } catch (error) {

    // กรณี API
    if (
      e &&
      e.parameter &&
      String(e.parameter.api) === '1'
    ) {

      return jsonResponse_({
        success: false,
        message: error.message,
        stack: String(error.stack || '')
      });
    }

    return HtmlService
      .createHtmlOutput(
        '<h2>เกิดข้อผิดพลาด</h2>' +
        '<p>' +
        escapeHtml_(error.message) +
        '</p>'
      );
  }
}


/* =========================================================
   POST API
========================================================= */

function doPost(e) {

  try {

    let body = {};

    if (
      e &&
      e.postData &&
      e.postData.contents
    ) {

      body =
        JSON.parse(
          e.postData.contents
        );
    }

    const action =
      String(
        body.action || ''
      ).trim();


    if (action === 'ping') {

      return jsonResponse_({
        success: true,
        message: 'API พร้อมใช้งาน'
      });
    }


    if (action === 'getDashboard') {

      return jsonResponse_({
        success: true,
        data: getApiData_()
      });
    }


    return jsonResponse_({
      success: false,
      message:
        'ไม่พบ action ที่ร้องขอ'
    });

  } catch (error) {

    return jsonResponse_({
      success: false,
      message: error.message
    });
  }
}


/* =========================================================
   API DATA
========================================================= */

function getApiData_() {

  ensureSystem_();

  const projects =
    getSheetObjects_(
      getSheet_(SHEETS.PROJECTS)
    );

  const reports =
    getSheetObjects_(
      getSheet_(SHEETS.REPORTS)
    );

  const users =
    getSheetObjects_(
      getSheet_(SHEETS.USERS)
    );

  const dashboard =
    buildDashboard_(
      projects,
      reports
    );

  return {
    appName: APP_NAME,

    fiscalYear:
      getCurrentFiscalYear_(
        projects
      ),

    dashboard:
      dashboard,

    projects:
      cleanObjects_(projects),

    reports:
      cleanObjects_(reports),

    usersCount:
      users.length
  };
}


/* =========================================================
   DASHBOARD
========================================================= */

function buildDashboard_(
  projects,
  reports
) {

  const statusCount = {
    'ฉบับร่าง': 0,
    'ส่งตรวจแล้ว': 0,
    'ขอแก้ไข': 0,
    'แก้ไขและส่งใหม่': 0,
    'รับรองแล้ว': 0
  };


  reports.forEach(function (r) {

    const status =
      String(
        r['สถานะรายงาน'] || ''
      );

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          statusCount,
          status
        )
    ) {
      statusCount[status]++;
    }
  });


  const totalBudget =
    projects.reduce(
      function (sum, p) {

        return sum +
          toNumber_(
            p['งบประมาณที่ได้รับ']
          );
      },
      0
    );


  /*
   * ใช้งบจากรายงานล่าสุดของแต่ละโครงการ
   * ป้องกันการรวมยอดซ้ำเมื่อโครงการมีหลายรายงาน
   */

  const latestByProject = {};

  reports.forEach(function (r) {

    const projectId =
      String(
        r.ProjectID || ''
      );

    if (!projectId) return;

    const currentDate =
      parseDate_(
        r['แก้ไขล่าสุด'] ||
        r['วันที่บันทึก']
      );

    if (
      !latestByProject[projectId] ||
      currentDate >
        latestByProject[
          projectId
        ].date
    ) {

      latestByProject[projectId] = {
        date: currentDate,
        report: r
      };
    }
  });


  let totalSpent = 0;
  let progressTotal = 0;
  let progressCount = 0;


  Object.keys(
    latestByProject
  ).forEach(
    function (projectId) {

      const r =
        latestByProject[
          projectId
        ].report;

      totalSpent +=
        toNumber_(
          r['งบประมาณเบิกจ่าย']
        );

      progressTotal +=
        toNumber_(
          r['ความก้าวหน้า']
        );

      progressCount++;
    }
  );


  const averageProgress =
    progressCount > 0
      ? progressTotal /
        progressCount
      : 0;


  return {

    totalProjects:
      projects.length,

    totalReports:
      reports.length,

    approvedReports:
      statusCount[
        'รับรองแล้ว'
      ],

    averageProgress:
      round2_(
        averageProgress
      ),

    totalBudget:
      totalBudget,

    totalSpent:
      totalSpent,

    totalBalance:
      totalBudget -
      totalSpent,

    statusCount:
      statusCount
  };
}


/* =========================================================
   SYSTEM SETUP
========================================================= */

function setupSystem() {

  const props =
    PropertiesService
      .getScriptProperties();


  /* -----------------------------
     DATABASE
  ----------------------------- */

  let ss = null;

  const oldSpreadsheetId =
    props.getProperty(
      'DATABASE_SPREADSHEET_ID'
    );


  if (oldSpreadsheetId) {

    try {

      ss =
        SpreadsheetApp
          .openById(
            oldSpreadsheetId
          );

    } catch (error) {

      ss = null;
    }
  }


  if (!ss) {

    ss =
      SpreadsheetApp
        .create(
          APP_NAME +
          ' - ฐานข้อมูล'
        );

    props.setProperty(
      'DATABASE_SPREADSHEET_ID',
      ss.getId()
    );
  }


  /* -----------------------------
     ROOT DRIVE FOLDER
  ----------------------------- */

  let rootFolder = null;

  const oldFolderId =
    props.getProperty(
      'ROOT_FOLDER_ID'
    );


  if (oldFolderId) {

    try {

      rootFolder =
        DriveApp
          .getFolderById(
            oldFolderId
          );

    } catch (error) {

      rootFolder = null;
    }
  }


  if (!rootFolder) {

    rootFolder =
      DriveApp
        .createFolder(
          APP_NAME +
          ' - หลักฐาน'
        );

    props.setProperty(
      'ROOT_FOLDER_ID',
      rootFolder.getId()
    );
  }


  createSheets_(ss);

  createMasterData_(ss);

  createAdmin_(ss);

  props.setProperty(
    'SYSTEM_INITIALIZED',
    'TRUE'
  );


  Logger.log(
    'ติดตั้งระบบสำเร็จ'
  );

  Logger.log(
    'ฐานข้อมูล: ' +
    ss.getUrl()
  );

  Logger.log(
    'โฟลเดอร์: ' +
    rootFolder.getUrl()
  );


  return {
    success: true,
    spreadsheetUrl:
      ss.getUrl(),
    folderUrl:
      rootFolder.getUrl()
  };
}


/* =========================================================
   ENSURE SYSTEM
========================================================= */

function ensureSystem_() {

  const props =
    PropertiesService
      .getScriptProperties();

  const databaseId =
    props.getProperty(
      'DATABASE_SPREADSHEET_ID'
    );

  if (!databaseId) {

    throw new Error(
      'ยังไม่ได้ติดตั้งฐานข้อมูล กรุณารัน setupSystem() ใน Apps Script ก่อน'
    );
  }


  try {

    SpreadsheetApp
      .openById(
        databaseId
      );

  } catch (error) {

    throw new Error(
      'ไม่สามารถเปิดฐานข้อมูลได้ กรุณาตรวจ DATABASE_SPREADSHEET_ID'
    );
  }
}


/* =========================================================
   CREATE SHEETS
========================================================= */

function createSheets_(ss) {

  const structures = {};


  structures[SHEETS.USERS] = [
    'UserID',
    'Email',
    'ชื่อ-สกุล',
    'กลุ่มงาน',
    'Role',
    'Active',
    'วันที่สร้าง'
  ];


  structures[SHEETS.PROJECTS] = [
    'ProjectID',
    'ปีงบประมาณ',
    'ชื่อโครงการ',
    'กลุ่มงาน',
    'อีเมลผู้รับผิดชอบ',
    'ชื่อผู้รับผิดชอบ',
    'แผนงาน/ยุทธศาสตร์',
    'แหล่งงบประมาณ',
    'งบประมาณที่ได้รับ',
    'วันที่เริ่ม',
    'วันที่สิ้นสุด',
    'สถานะโครงการ',
    'วันที่สร้าง',
    'ผู้สร้าง'
  ];


  structures[
    SHEETS.REPORTS
  ] = [
    'ReportID',
    'ProjectID',
    'วันที่บันทึก',
    'ผู้บันทึก',
    'อีเมลผู้บันทึก',
    'ผลผลิต/ผลการดำเนินงาน',
    'ตัวชี้วัด',
    'ค่าเป้าหมาย',
    'ผลที่เกิดขึ้น',
    'ความก้าวหน้า',
    'งบประมาณที่ได้รับ',
    'งบประมาณเบิกจ่าย',
    'งบประมาณคงเหลือ',
    'ปัญหา/อุปสรรค',
    'ข้อเสนอแนะ',
    'สถานะรายงาน',
    'วันที่ส่ง',
    'ผู้ตรวจ',
    'วันที่ตรวจ',
    'วันที่รับรอง',
    'แก้ไขล่าสุด'
  ];


  structures[
    SHEETS.EVIDENCE
  ] = [
    'EvidenceID',
    'ReportID',
    'ProjectID',
    'ชื่อไฟล์',
    'ประเภทไฟล์',
    'FileID',
    'GoogleDriveURL',
    'วันที่อัปโหลด',
    'ผู้อัปโหลด',
    'อีเมลผู้อัปโหลด'
  ];


  structures[
    SHEETS.TARGETS
  ] = [
    'TargetID',
    'ReportID',
    'ProjectID',
    'หน่วยงานปลายทาง',
    'ชื่อแบบรายงาน',
    'ปีงบประมาณ',
    'รอบรายงาน',
    'วันที่สร้าง'
  ];


  structures[
    SHEETS.REVIEWS
  ] = [
    'LogID',
    'ReportID',
    'ProjectID',
    'ผู้ตรวจ',
    'อีเมลผู้ตรวจ',
    'วันที่ตรวจ',
    'สถานะเดิม',
    'สถานะใหม่',
    'ข้อเสนอแนะ'
  ];


  structures[
    SHEETS.MASTER
  ] = [
    'ประเภท',
    'ค่า',
    'Active',
    'ลำดับ'
  ];


  Object.keys(
    structures
  ).forEach(
    function (sheetName) {

      let sheet =
        ss.getSheetByName(
          sheetName
        );


      if (!sheet) {

        sheet =
          ss.insertSheet(
            sheetName
          );
      }


      if (
        sheet.getLastRow() === 0
      ) {

        const headers =
          structures[
            sheetName
          ];


        sheet
          .getRange(
            1,
            1,
            1,
            headers.length
          )
          .setValues([
            headers
          ]);


        sheet
          .getRange(
            1,
            1,
            1,
            headers.length
          )
          .setFontWeight(
            'bold'
          )
          .setBackground(
            '#312E81'
          )
          .setFontColor(
            '#FFFFFF'
          );


        sheet.setFrozenRows(1);
      }
    }
  );


  const defaultSheet =
    ss.getSheetByName(
      'Sheet1'
    );


  if (
    defaultSheet &&
    ss.getSheets().length > 1 &&
    defaultSheet.getLastRow() === 0
  ) {

    ss.deleteSheet(
      defaultSheet
    );
  }
}


/* =========================================================
   ADMIN
========================================================= */

function createAdmin_(ss) {

  let email = '';


  try {

    email =
      Session
        .getActiveUser()
        .getEmail();

  } catch (error) {}


  if (!email) {

    try {

      email =
        Session
          .getEffectiveUser()
          .getEmail();

    } catch (error) {}
  }


  if (!email) return;


  const sheet =
    ss.getSheetByName(
      SHEETS.USERS
    );


  const users =
    getSheetObjects_(
      sheet
    );


  const exists =
    users.some(
      function (u) {

        return String(
          u.Email || ''
        )
          .trim()
          .toLowerCase() ===
          email
            .trim()
            .toLowerCase();
      }
    );


  if (!exists) {

    sheet.appendRow([
      generateId_('USR'),
      email,
      'ผู้ดูแลระบบ',
      'กลุ่มนโยบายและแผน',
      'ADMIN',
      true,
      new Date()
    ]);
  }
}


/* =========================================================
   MASTER DATA
========================================================= */

function createMasterData_(ss) {

  const sheet =
    ss.getSheetByName(
      SHEETS.MASTER
    );


  if (
    sheet.getLastRow() > 1
  ) {
    return;
  }


  const data = [

    ['ROLE', 'USER', true, 1],

    [
      'ROLE',
      'DIRECTOR',
      true,
      2
    ],

    [
      'ROLE',
      'EXECUTIVE',
      true,
      3
    ],

    [
      'ROLE',
      'ADMIN',
      true,
      4
    ],


    [
      'REPORT_STATUS',
      'ฉบับร่าง',
      true,
      1
    ],

    [
      'REPORT_STATUS',
      'ส่งตรวจแล้ว',
      true,
      2
    ],

    [
      'REPORT_STATUS',
      'ขอแก้ไข',
      true,
      3
    ],

    [
      'REPORT_STATUS',
      'แก้ไขและส่งใหม่',
      true,
      4
    ],

    [
      'REPORT_STATUS',
      'รับรองแล้ว',
      true,
      5
    ],


    [
      'REPORT_TARGET',
      'สพฐ.',
      true,
      1
    ],

    [
      'REPORT_TARGET',
      'กระทรวงศึกษาธิการ',
      true,
      2
    ],

    [
      'REPORT_TARGET',
      'จังหวัด',
      true,
      3
    ],

    [
      'REPORT_TARGET',
      'เขตตรวจราชการ',
      true,
      4
    ],

    [
      'REPORT_TARGET',
      'หน่วยงานอื่น',
      true,
      5
    ]
  ];


  sheet
    .getRange(
      2,
      1,
      data.length,
      4
    )
    .setValues(
      data
    );
}


/* =========================================================
   DATABASE
========================================================= */

function getDatabase_() {

  ensureSystem_();

  const id =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        'DATABASE_SPREADSHEET_ID'
      );

  return SpreadsheetApp
    .openById(id);
}


function getSheet_(
  sheetName
) {

  const sheet =
    getDatabase_()
      .getSheetByName(
        sheetName
      );


  if (!sheet) {

    throw new Error(
      'ไม่พบ Sheet: ' +
      sheetName
    );
  }


  return sheet;
}


/* =========================================================
   SHEET → OBJECT
========================================================= */

function getSheetObjects_(
  sheet
) {

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();


  if (
    lastRow < 2 ||
    lastColumn < 1
  ) {
    return [];
  }


  const values =
    sheet
      .getRange(
        1,
        1,
        lastRow,
        lastColumn
      )
      .getValues();


  const headers =
    values[0];


  return values
    .slice(1)
    .filter(
      function (row) {

        return row.some(
          function (value) {

            return (
              value !== '' &&
              value !== null
            );
          }
        );
      }
    )
    .map(
      function (row) {

        const obj = {};


        headers.forEach(
          function (
            header,
            index
          ) {

            obj[header] =
              serializeValue_(
                row[index]
              );
          }
        );


        return obj;
      }
    );
}


/* =========================================================
   JSON
========================================================= */

function jsonResponse_(
  object
) {

  return ContentService
    .createTextOutput(
      JSON.stringify(
        object
      )
    )
    .setMimeType(
      ContentService
        .MimeType
        .JSON
    );
}


/* =========================================================
   HELPERS
========================================================= */

function serializeValue_(
  value
) {

  if (
    Object.prototype
      .toString
      .call(value) ===
    '[object Date]'
  ) {

    return Utilities
      .formatDate(
        value,
        Session
          .getScriptTimeZone(),
        'yyyy-MM-dd HH:mm:ss'
      );
  }

  return value;
}


function cleanObjects_(
  rows
) {

  return JSON.parse(
    JSON.stringify(
      rows
    )
  );
}


function toNumber_(
  value
) {

  const number =
    Number(value);

  return isNaN(number)
    ? 0
    : number;
}


function round2_(
  value
) {

  return Math.round(
    Number(value || 0) *
    100
  ) / 100;
}


function parseDate_(
  value
) {

  const date =
    new Date(value);

  if (
    isNaN(
      date.getTime()
    )
  ) {

    return new Date(0);
  }

  return date;
}


function generateId_(
  prefix
) {

  return (
    prefix +
    '-' +
    Utilities
      .getUuid()
      .replace(
        /-/g,
        ''
      )
      .substring(
        0,
        12
      )
      .toUpperCase()
  );
}


function getCurrentFiscalYear_(
  projects
) {

  const years =
    projects
      .map(
        function (p) {

          return Number(
            p['ปีงบประมาณ']
          );
        }
      )
      .filter(
        function (year) {

          return (
            !isNaN(year) &&
            year > 0
          );
        }
      );


  if (years.length) {

    return Math.max
      .apply(
        null,
        years
      );
  }


  const today =
    new Date();

  return (
    today.getFullYear() +
    543 +
    (
      today.getMonth() >= 9
        ? 1
        : 0
    )
  );
}


function escapeHtml_(
  value
) {

  return String(
    value || ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}