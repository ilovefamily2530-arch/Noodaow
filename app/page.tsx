export const dynamic = "force-dynamic";

async function getData() {
  const url = process.env.SHEET_API_URL;

  if (!url) {
    return {
      success: false,
      message: "ไม่พบ SHEET_API_URL ในไฟล์ .env.local",
    };
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        success: false,
        message: `HTTP ${response.status}`,
      };
    }

    const result = await response.json();

    return result;
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "ไม่สามารถเชื่อมต่อ Apps Script ได้",
    };
  }
}

export default async function Home() {
  const result = await getData();

  if (!result.success) {
    return (
      <main
        style={{
          maxWidth: 1000,
          margin: "60px auto",
          padding: 30,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1>ระบบติดตามและรายงานผลโครงการ</h1>

        <div
          style={{
            marginTop: 30,
            padding: 25,
            borderRadius: 16,
            background: "#fef3c7",
            color: "#92400e",
          }}
        >
          <h2>❌ ยังเชื่อมต่อไม่ได้</h2>
          <p>{result.message}</p>
        </div>
      </main>
    );
  }

  const data = result.data;
  const dashboard = data.dashboard;

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 30,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>ระบบติดตามและรายงานผลโครงการ</h1>

      <p>
        ปีงบประมาณ {data.fiscalYear}
      </p>

      <div
        style={{
          marginTop: 20,
          padding: 20,
          background: "#dcfce7",
          color: "#166534",
          borderRadius: 16,
        }}
      >
        <strong>
          ✅ เชื่อมต่อ Google Apps Script สำเร็จ
        </strong>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(200px,1fr))",
          gap: 16,
          marginTop: 25,
        }}
      >
        <Card
          title="โครงการทั้งหมด"
          value={dashboard.totalProjects}
        />

        <Card
          title="รายงานทั้งหมด"
          value={dashboard.totalReports}
        />

        <Card
          title="รับรองแล้ว"
          value={dashboard.approvedReports}
        />

        <Card
          title="ความก้าวหน้าเฉลี่ย"
          value={`${dashboard.averageProgress}%`}
        />
      </div>
    </main>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        padding: 22,
        background: "#ffffff",
        borderRadius: 16,
        boxShadow:
          "0 5px 20px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ color: "#6b7280" }}>
        {title}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 30,
          fontWeight: 700,
          color: "#312e81",
        }}
      >
        {value}
      </div>
    </div>
  );
}