import { useState, useEffect } from 'react';

// Interfaces
interface LogEntry {
  id: string;
  time: string;
  action: string;
  method: string;
  url: string;
  payload?: unknown;
  response?: unknown;
  success: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'transactions' | 'console'>('overview');
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [serverVersion, setServerVersion] = useState<string>('Unknown');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [targetCpoUrl, setTargetCpoUrl] = useState<string>('http://localhost:3000');

  // Input states
  const [countryCode, setCountryCode] = useState('TW');
  const [partyId, setPartyId] = useState('NPT');
  const [locationId, setLocationId] = useState('loc_001');
  const [tariffId, setTariffId] = useState('tariff_001');
  const [sessionId, setSessionId] = useState('session_id_123');
  const [evseUid, setEvseUid] = useState('evse_uid_123');
  const [evseStatus, setEvseStatus] = useState('AVAILABLE');
  const [transactionNo, setTransactionNo] = useState('txn_001');

  // Payload templates
  const [locationPayload, setLocationPayload] = useState(JSON.stringify({
    operator: { name: "Operator Name" },
    name: "Station Name",
    city: "Taipei",
    state: "Taipei City",
    address: "No. 1, Sec. 1, Xinyi Rd.",
    postal_code: "100",
    coordinates: { latitude: "25.0339", longitude: "121.5645" },
    time_zone: "Asia/Taipei",
    parking_type: "ON_STREET",
    opening_times: "24/7",
    charging_when_closed: true,
    evses: [
      {
        uid: "evse_uid_123",
        status: "AVAILABLE",
        evse_id: "TW*NPT*E*123",
        floor_level: "1F",
        capabilities: ["REMOTE_START_STOP_ALLOWED"],
        last_updated: new Date().toISOString(),
        physical_reference: "Ref-123",
        connectors: [
          {
            id: "1",
            format: "CABLE",
            standard: "IEC_62196_T2",
            power_type: "AC_3PHASE",
            tariff_ids: ["tariff_001"],
            max_voltage: 400,
            max_amperage: 32,
            max_electric_power: 22000,
            last_updated: new Date().toISOString()
          }
        ]
      }
    ]
  }, null, 2));

  const [tariffPayload, setTariffPayload] = useState(JSON.stringify({
    currency: "TWD",
    type: "AD_HOC",
    tariff_alt_url: "https://cpo.com/tariffs/001",
    last_updated: new Date().toISOString(),
    tariff_alt_text: [
      { language: "zh", text: "標準費率" }
    ],
    elements: [
      {
        price_components: [
          { type: "ENERGY", price: 8.5, vat: 0.05, step_size: 1 }
        ]
      }
    ]
  }, null, 2));

  const [sessionPayload, setSessionPayload] = useState(JSON.stringify({
    status: "ACTIVE",
    cdr_token: "token_abc123",
    kwh: 5.4,
    total_cost: { excl_vat: 45.9, incl_vat: 48.2 },
    charging_periods: [
      {
        dimensions: [
          { type: "CURRENT", volume: 16 },
          { type: "POWER", volume: 11 },
          { type: "STATE_OF_CHARGE", volume: 45 },
          { type: "ENERGY", volume: 5.4 }
        ]
      }
    ],
    last_updated: new Date().toISOString()
  }, null, 2));

  const [cdrPayload, setCdrPayload] = useState(JSON.stringify({
    authorization_reference: "session_id_123",
    total_cost: { excl_vat: 120.0, incl_vat: 126.0 },
    total_parking_cost: { excl_vat: 0.0, incl_vat: 0.0 },
    total_energy: 15.0,
    total_time: 3600,
    end_date_time: new Date().toISOString()
  }, null, 2));

  // Check connection status to NestJS server
  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const res = await fetch('/ocpi/versions');
        if (res.ok) {
          const body = await res.json();
          if (!active) return;
          setIsOnline(true);
          if (body.data && body.data.length > 0) {
            setServerVersion(body.data[0].version);
          }
        } else {
          if (!active) return;
          setIsOnline(false);
        }
      } catch {
        if (!active) return;
        setIsOnline(false);
      }
    };
    
    // Call asynchronously to avoid warning
    checkStatus();
    const timer = setInterval(checkStatus, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Logger helper
  const addLog = (action: string, method: string, url: string, payload: unknown, response: unknown, success: boolean) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      action,
      method,
      url,
      payload,
      response,
      success
    };
    setLogs(prev => [newEntry, ...prev]);
  };

  // Generic request handler
  const sendRequest = async (action: string, endpoint: string, method: 'POST' | 'PUT' | 'PATCH', rawBody?: string) => {
    let parsedBody: unknown = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        alert('Invalid JSON structure. Please check the editor content.');
        return;
      }
    }

    try {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (parsedBody) {
        options.body = JSON.stringify(parsedBody);
      }

      const res = await fetch(endpoint, options);
      const resData = await res.json() as { status_message?: string; message?: string };
      addLog(action, method, endpoint, parsedBody, resData, res.ok);
      if (res.ok) {
        setActiveTab('console');
      } else {
        alert(`API Error: ${resData.status_message || resData.message || 'Request failed'}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(action, method, endpoint, parsedBody, { error: errorMessage }, false);
      alert(`Network Error: ${errorMessage}`);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-logo">⚡</div>
          <span className="brand-name">OCPI Simulator</span>
        </div>

        <ul className="nav-links">
          <li>
            <a 
              className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Overview
            </a>
          </li>
          <li>
            <a 
              className={`nav-item ${activeTab === 'telemetry' ? 'active' : ''}`}
              onClick={() => setActiveTab('telemetry')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              Telemetry Sender
            </a>
          </li>
          <li>
            <a 
              className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Transactions
            </a>
          </li>
          <li>
            <a 
              className={`nav-item ${activeTab === 'console' ? 'active' : ''}`}
              onClick={() => setActiveTab('console')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              Live Logs ({logs.length})
            </a>
          </li>
        </ul>

        <div className="sidebar-footer">
          <p>OCPI Version 2.2.1</p>
          <p style={{ marginTop: '4px' }}>Status: {isOnline ? 'Online' : 'Offline'}</p>
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-title">
            {activeTab === 'overview' && 'System Overview'}
            {activeTab === 'telemetry' && 'Simulate EVSE Telemetry (Locations & Tariffs)'}
            {activeTab === 'transactions' && 'Simulate Sessions & Billing CDRs'}
            {activeTab === 'console' && 'Request Console logs'}
          </div>

          <div className={`server-status-badge ${!isOnline ? 'offline' : ''}`}>
            <span className="status-dot"></span>
            {isOnline ? `Connected (OCPI ${serverVersion})` : 'Disconnected'}
          </div>
        </header>

        {/* Workspace */}
        <div className="workspace">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              <div className="card status-grid">
                <div className="status-card">
                  <span className="label">Server URL</span>
                  <span className="value" style={{ fontSize: '18px', fontFamily: 'monospace' }}>http://localhost:3030</span>
                </div>
                <div className="status-card">
                  <span className="label">Connected CPO Target</span>
                  <span className="value" style={{ fontSize: '18px', fontFamily: 'monospace' }}>{targetCpoUrl}</span>
                </div>
                <div className="status-card">
                  <span className="label">API Logs Tracked</span>
                  <span className="value">{logs.length}</span>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">🔌 Welcome to OCPI Mock Hub</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
                  This dashboard gives you a clean visual playground to simulate e-Roaming data transactions.
                  Using the tabs on the left, you can trigger Location details syncing, EVSE status heartbeats, and charging Session CDR records directly to your CPO dashboard.
                </p>
                <div className="form-group" style={{ maxWidth: '400px' }}>
                  <label>Config CPO Base Url (For display)</label>
                  <input 
                    type="text" 
                    value={targetCpoUrl} 
                    onChange={(e) => setTargetCpoUrl(e.target.value)} 
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 2: TELEMETRY */}
          {activeTab === 'telemetry' && (
            <>
              {/* Location Sync */}
              <div className="card">
                <h3 className="card-title">📡 Simulate Location Update</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Country Code</label>
                    <input type="text" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Party ID</label>
                    <input type="text" value={partyId} onChange={(e) => setPartyId(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Location ID</label>
                    <input type="text" value={locationId} onChange={(e) => setLocationId(e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Location JSON Payload</label>
                  <textarea value={locationPayload} onChange={(e) => setLocationPayload(e.target.value)} />
                </div>
                <button 
                  className="button"
                  onClick={() => sendRequest('Send Location', `/simulate/locations/${countryCode}/${partyId}/${locationId}`, 'POST', locationPayload)}
                >
                  Trigger Location Sync (PUT)
                </button>
              </div>

              {/* Tariff Sync */}
              <div className="card">
                <h3 className="card-title">💰 Simulate Tariff Upload</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Tariff ID</label>
                    <input type="text" value={tariffId} onChange={(e) => setTariffId(e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Tariff JSON Payload</label>
                  <textarea value={tariffPayload} onChange={(e) => setTariffPayload(e.target.value)} />
                </div>
                <button 
                  className="button"
                  onClick={() => sendRequest('Send Tariff', `/simulate/tariffs/${countryCode}/${partyId}/${tariffId}`, 'POST', tariffPayload)}
                >
                  Trigger Tariff Sync (PUT)
                </button>
              </div>

              {/* EVSE Status Patch */}
              <div className="card">
                <h3 className="card-title">🔌 EVSE Status Heartbeat</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>EVSE UID</label>
                    <input type="text" value={evseUid} onChange={(e) => setEvseUid(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>New Status</label>
                    <select value={evseStatus} onChange={(e) => setEvseStatus(e.target.value)}>
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="CHARGING">CHARGING</option>
                      <option value="RESERVED">RESERVED</option>
                      <option value="OUTOFORDER">OUTOFORDER</option>
                      <option value="INOPERATIVE">INOPERATIVE</option>
                    </select>
                  </div>
                </div>
                <button 
                  className="button"
                  onClick={() => sendRequest('Patch EVSE Status', `/simulate/locations/${countryCode}/${partyId}/${locationId}/${evseUid}`, 'POST', JSON.stringify({ status: evseStatus, last_updated: new Date().toISOString() }))}
                >
                  Send EVSE Status Patch (PATCH)
                </button>
              </div>
            </>
          )}

          {/* TAB 3: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <>
              {/* Session Update */}
              <div className="card">
                <h3 className="card-title">⚡ Charging Session Updates</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Session ID</label>
                    <input type="text" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Session JSON Payload</label>
                  <textarea value={sessionPayload} onChange={(e) => setSessionPayload(e.target.value)} />
                </div>
                <button 
                  className="button"
                  onClick={() => sendRequest('Send Session Details', `/simulate/sessions/${countryCode}/${partyId}/${sessionId}`, 'POST', sessionPayload)}
                >
                  Update Active Session (PUT)
                </button>
              </div>

              {/* CDR Post */}
              <div className="card">
                <h3 className="card-title">🧾 Send Charge Detail Record (CDR)</h3>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>CDR JSON Payload</label>
                  <textarea value={cdrPayload} onChange={(e) => setCdrPayload(e.target.value)} />
                </div>
                <button 
                  className="button"
                  onClick={() => sendRequest('Send CDR Receipt', '/simulate/cdrs', 'POST', cdrPayload)}
                >
                  Post Final CDR Receipt (POST)
                </button>
              </div>

              {/* Cancel Session */}
              <div className="card">
                <h3 className="card-title">❌ Cancel Transaction</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Transaction / Session ID</label>
                    <input type="text" value={transactionNo} onChange={(e) => setTransactionNo(e.target.value)} />
                  </div>
                </div>
                <button 
                  className="button button-secondary"
                  onClick={() => sendRequest('Cancel Session', `/simulate/sessions/cancel/${countryCode}/${partyId}/${transactionNo}`, 'POST')}
                >
                  Force Cancel charging session
                </button>
              </div>
            </>
          )}

          {/* TAB 4: CONSOLE */}
          {activeTab === 'console' && (
            <div className="card console-container" style={{ flexGrow: 1 }}>
              <div className="console-header">
                <h3 className="card-title" style={{ marginBottom: 0 }}>💻 API Activity Monitor</h3>
                <button className="button button-secondary" onClick={() => setLogs([])}>Clear Console</button>
              </div>
              <div className="console-body">
                {logs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                    No activity logs recorded yet. Send a simulation request to populate logs.
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className={`console-log-entry ${log.success ? 'success' : 'error'}`}>
                      <div className="log-meta">
                        <span>Time: {log.time} | Action: {log.action}</span>
                        <span style={{ color: log.success ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 'bold' }}>
                          {log.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{log.method}</span>{' '}
                        <span className="log-path">{log.url}</span>
                      </div>
                      
                      {!!log.payload && (
                        <details style={{ marginTop: '8px' }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--accent-blue)', fontSize: '11px' }}>View Request Payload</summary>
                          <pre className="log-body" style={{ marginTop: '4px' }}>
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </details>
                      )}

                      {!!log.response && (
                        <details style={{ marginTop: '6px' }} open>
                          <summary style={{ cursor: 'pointer', color: 'var(--accent-blue)', fontSize: '11px' }}>View Response</summary>
                          <pre className="log-body" style={{ marginTop: '4px' }}>
                            {JSON.stringify(log.response, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
