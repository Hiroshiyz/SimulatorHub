import { useSimulator } from "../context/SimulatorContext";

export default function OverviewTab() {
  const {
    targetCpoUrl,
    locations,
    sessions,
    initializeMockStations,
    handleSyncLocation,
    handleSyncTariff,
  } = useSimulator();

  const allEvsesCount = locations.flatMap((loc) => loc.evses).length;

  return (
    <>
      <div className="card status-grid">
        <div className="status-card">
          <span className="label">HUB 本地連接埠</span>
          <span
            className="value"
            style={{ fontSize: "16px", fontFamily: "monospace" }}
          >
            {targetCpoUrl}
          </span>
        </div>
        <div className="status-card">
          <span className="label">目前偵測到的 CPO 站點數</span>
          <span className="value">{locations.length} 站</span>
        </div>
        <div className="status-card">
          <span className="label">資料庫充電樁總數</span>
          <span className="value">{allEvsesCount} 支</span>
        </div>
        <div className="status-card">
          <span className="label">歷史交易總數</span>
          <span className="value">{sessions.length} 筆</span>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">漫遊中心系統原理說明</h3>
        <p
          style={{
            color: "var(--text-secondary)",
            lineHeight: "1.7",
            marginBottom: "16px",
          }}
        >
          本模擬器模擬了符合 <strong>OCPI 2.2.1 協定規格</strong> 的電子漫遊交易流程。 運作機制如下：
        </p>
        <ul
          style={{
            color: "var(--text-secondary)",
            paddingLeft: "20px",
            lineHeight: "1.7",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <li>
            <strong>充電樁狀態 (EVSE) ─► CPO</strong>：車主插槍或狀態改變時，充電樁產生狀態心跳與數據封包。
          </li>
          <li>
            <strong>CPO ─► HUB</strong>：CPO 發送 <code>PUT/PATCH Locations/Sessions</code> 將最新充電狀態與度數推送至 Mock HUB 儲存於 PostgreSQL。
          </li>
          <li>
            <strong>HUB ─► EMSP</strong>：Mock HUB 接收並解析，立即透過註冊的 Token C 將交易封包 <strong>Forward (轉發)</strong> 給對接的 EMSP 車友 App 做即時電量顯示。
          </li>
        </ul>

        {locations.length === 0 && (
          <div
            style={{
              background: "rgba(14,165,233,0.06)",
              border: "1px dashed var(--accent-purple)",
              borderRadius: "12px",
              padding: "20px",
              textAlign: "center",
              marginTop: "20px",
            }}
          >
            <p
              style={{
                color: "white",
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              目前 PostgreSQL 資料庫中無 CPO 站點資料
            </p>
            <button className="button" onClick={initializeMockStations}>
              一鍵初始化 4 座模擬充電樁
            </button>
          </div>
        )}
      </div>

      {locations.length > 0 && (
        <div className="card" style={{ marginTop: "20px" }}>
          <h3 className="card-title">OCPI 漫遊數據同步控制</h3>
          <p
            style={{
              color: "var(--text-secondary)",
              lineHeight: "1.6",
              marginBottom: "16px",
            }}
          >
            在 OCPI 連線架構下，CPO 模擬端可在此主動將「場站資訊 (Location)」與「費率規格 (Tariff)」同步傳送給 HUB，並由 HUB 即時轉發給對接的 EMSP，完成漫遊站點對接。
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              className="button"
              onClick={handleSyncLocation}
              style={{ background: "var(--accent-purple)", color: "white" }}
            >
              傳送場站資訊 (PUT Location)
            </button>
            <button
              className="button button-secondary"
              onClick={() => handleSyncTariff()}
            >
              傳送費率資訊 (PUT Tariff)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
