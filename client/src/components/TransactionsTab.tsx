import { useSimulator } from "../context/SimulatorContext";

export default function TransactionsTab() {
  const { sessions, cdrs } = useSimulator();

  return (
    <>
      {/* Active Sessions */}
      <div className="card">
        <h3 className="card-title">Prisma DB 中的 Sessions 歷史紀錄</h3>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: "12px" }}>Session ID</th>
                <th style={{ padding: "12px" }}>充電樁 UID</th>
                <th style={{ padding: "12px" }}>度數 (kWh)</th>
                <th style={{ padding: "12px" }}>目前狀態</th>
                <th style={{ padding: "12px" }}>最後更新時間</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    資料庫中無交易 Session
                  </td>
                </tr>
              ) : (
                sessions.map((sess) => (
                  <tr
                    key={sess.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <td style={{ padding: "12px", fontFamily: "monospace" }}>
                      {sess.id}
                    </td>
                    <td style={{ padding: "12px", fontFamily: "monospace" }}>
                      {sess.evseUid}
                    </td>
                    <td style={{ padding: "12px" }}>{sess.kwh}</td>
                    <td style={{ padding: "12px" }}>
                      <span
                        className={`evse-badge ${sess.status.toLowerCase()}`}
                        style={{ fontSize: "10px" }}
                      >
                        {sess.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "var(--text-muted)" }}>
                      {new Date(sess.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CDR receipts */}
      <div className="card">
        <h3 className="card-title">Prisma DB 中的 CDR 帳單紀錄</h3>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: "12px" }}>CDR ID</th>
                <th style={{ padding: "12px" }}>度數 (kWh)</th>
                <th style={{ padding: "12px" }}>計費金額 (TWD)</th>
                <th style={{ padding: "12px" }}>充電時間 (秒)</th>
                <th style={{ padding: "12px" }}>記錄時間</th>
              </tr>
            </thead>
            <tbody>
              {cdrs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    資料庫中無結帳 CDR
                  </td>
                </tr>
              ) : (
                cdrs.map((cdr) => {
                  const raw = cdr.rawJson || {};
                  const totalCost = raw.total_cost?.incl_vat || 0;
                  const totalTime = raw.total_time || 0;
                  return (
                    <tr
                      key={cdr.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <td style={{ padding: "12px", fontFamily: "monospace" }}>
                        {cdr.id}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {raw.total_energy || 0} kWh
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: "var(--accent-yellow)",
                          fontWeight: 600,
                        }}
                      >
                        NT$ {totalCost}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {totalTime} 秒
                      </td>
                      <td style={{ padding: "12px", color: "var(--text-muted)" }}>
                        {new Date(cdr.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
