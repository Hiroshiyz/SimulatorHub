import { useSimulator } from "../context/SimulatorContext";
import { ArrowRight, Cpu, Database, Layers, MapPin, Square, UserCheck, Zap } from "../components/Icons";

export default function Dashboard() {
  const {
    locations, sessions, cpos, emsps, logs, activeChargingSessions,
    stopSimulatedCharging, setActiveTab, isOnline,
  } = useSimulator();

  const activeSessions = Object.values(activeChargingSessions);
  const evseCount = locations.reduce((total, location) => total + (location.evses?.length || 0), 0);
  const availableCount = locations.reduce(
    (total, location) => total + (location.evses?.filter((evse) => evse.status === "AVAILABLE").length || 0), 0,
  );
  const activeEmsps = emsps.filter((emsp) => emsp.active).length;
  const totalKwh = sessions.reduce((total, session) => total + (session.kwh || 0), 0);
  const recentLogs = logs.slice(-5).reverse();

  return (
    <div className="workspace dashboard-page">
      <section className="command-hero">
        <div>
          <span className="eyebrow">OPERATIONS COMMAND CENTER</span>
          <h1>HUB 營運控制中心</h1>
          <p>確認服務健康度，或直接進入最常用的模擬操作。</p>
        </div>
        <div className={`hero-health ${isOnline ? "healthy" : "offline"}`}>
          <span className="health-pulse" />
          <div><small>系統狀態</small><strong>{isOnline ? "所有服務正常" : "HUB 目前離線"}</strong></div>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card blue"><div className="metric-icon"><MapPin size={20} /></div><div><span>充電基礎設施</span><strong>{locations.length} <small>場站</small></strong><p>{availableCount} / {evseCount} 槍可使用</p></div></article>
        <article className="metric-card green"><div className="metric-icon"><Zap size={20} /></div><div><span>即時充電</span><strong>{activeSessions.length} <small>進行中</small></strong><p>累計 {totalKwh.toFixed(1)} kWh</p></div></article>
        <article className="metric-card purple"><div className="metric-icon"><Layers size={20} /></div><div><span>HUB 租戶</span><strong>{cpos.length + emsps.length} <small>合作方</small></strong><p>{cpos.length} CPO · {activeEmsps}/{emsps.length} eMSP 上線</p></div></article>
        <article className="metric-card amber"><div className="metric-icon"><Database size={20} /></div><div><span>充電紀錄</span><strong>{sessions.length} <small>Sessions</small></strong><p>由 HUB 統一彙整</p></div></article>
      </section>

      <section className="dashboard-layout">
        <div className="dashboard-main-column">
          <div className="section-heading"><div><span className="eyebrow">QUICK START</span><h2>你想進行哪一項操作？</h2></div></div>
          <div className="quick-action-grid">
            <button className="quick-action primary-action" onClick={() => setActiveTab("cpo-sim")}><span className="quick-action-icon"><Zap size={24} /></span><span><strong>模擬一次充電</strong><small>選擇場站、槍頭與 RFID / AutoCharge 情境</small></span><ArrowRight size={18} /></button>
            <button className="quick-action" onClick={() => setActiveTab("hub-router")}><span className="quick-action-icon"><Layers size={24} /></span><span><strong>管理 HUB 路由</strong><small>新增租戶、憑證與資料轉送通道</small></span><ArrowRight size={18} /></button>
            <button className="quick-action" onClick={() => setActiveTab("emsp-sim")}><span className="quick-action-icon"><UserCheck size={24} /></span><span><strong>發送 eMSP 指令</strong><small>測試遠端開始與停止充電命令</small></span><ArrowRight size={18} /></button>
          </div>

          <div className="panel active-panel">
            <div className="panel-header"><div><span className="eyebrow">LIVE SESSIONS</span><h2>進行中的充電</h2></div><button className="text-button" onClick={() => setActiveTab("cpo-sim")}>前往控制台 <ArrowRight size={14} /></button></div>
            {activeSessions.length === 0 ? (
              <div className="empty-state"><span><Zap size={24} /></span><strong>目前沒有進行中的充電</strong><p>前往 CPO 模擬器，選擇一支可用槍頭開始測試。</p><button onClick={() => setActiveTab("cpo-sim")}>建立模擬充電</button></div>
            ) : (
              <div className="session-list">{activeSessions.map((session) => (
                <article className="session-row" key={session.sessionId}><span className="live-indicator" /><div className="session-identity"><strong>{session.evseUid}</strong><small>{session.sessionId}</small></div><div className="session-value"><small>電量</small><strong>{session.kwh.toFixed(2)} kWh</strong></div><div className="session-value"><small>SoC</small><strong>{session.soc}%</strong></div><div className="session-progress"><span style={{ width: `${session.soc}%` }} /></div><button className="stop-button" onClick={() => stopSimulatedCharging(session.evseUid)} title="停止充電"><Square size={14} /> 停止</button></article>
              ))}</div>
            )}
          </div>
        </div>

        <aside className="dashboard-side-column">
          <div className="panel network-panel">
            <div className="panel-header"><div><span className="eyebrow">OCPI NETWORK</span><h2>資料通道</h2></div></div>
            <div className="network-flow"><div className="network-node"><span><MapPin size={18} /></span><div><strong>CPO</strong><small>{cpos.length} 個租戶</small></div></div><div className="network-line"><span /></div><div className="network-node hub"><span><Cpu size={18} /></span><div><strong>Central HUB</strong><small>{isOnline ? "路由引擎正常" : "連線中斷"}</small></div></div><div className="network-line"><span /></div><div className="network-node"><span><UserCheck size={18} /></span><div><strong>eMSP</strong><small>{activeEmsps} 個通道啟用</small></div></div></div>
          </div>
          <div className="panel activity-panel">
            <div className="panel-header"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>最近活動</h2></div></div>
            <div className="activity-list">{recentLogs.map((log) => (<div className="activity-item" key={log.id}><span className={`activity-dot ${log.type}`} /><div><strong>{log.action}</strong><p>{log.detail}</p><small>{log.module} · {log.time}</small></div></div>))}</div>
          </div>
        </aside>
      </section>
    </div>
  );
}
