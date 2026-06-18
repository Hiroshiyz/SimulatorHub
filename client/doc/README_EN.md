# Mock Hub Roaming Central Hub - UI Walkthrough and Architecture Guide

[中文版](README.md)

This project provides a complete OCPI (Open Charge Point Interface) simulation and roaming hub platform. Through this platform, you can simulate the data exchange and control processes between Charge Point Operators (CPOs), Smart Hubs (HUBs), and e-Mobility Service Providers (eMSPs).

---

## System Topology and Data Flow

The core data exchange flows simulated by this platform are as follows:

```mermaid
graph TD
    subgraph Charge Point Operator (CPO)
        CPO_SIM[Charger Simulator]
    end

    subgraph Roaming Central Hub (HUB)
        CENTRAL_HUB[OCPI Central HUB]
        LOGS[Real-time Telemetry Logs]
    end

    subgraph Service Provider (eMSP)
        EMSP_NPT[eMSP: NPT]
        EMSP_SH[eMSP: SMARTHUBLCU]
    end

    %% Data Transfer Directions
    CPO_SIM -->|1. Push Locations/Tariffs/Sessions/CDRs| CENTRAL_HUB
    CENTRAL_HUB -->|2. Route & Filtered Forward| EMSP_NPT
    CENTRAL_HUB -->|2. Route & Filtered Forward| EMSP_SH
    
    %% Control Command Directions
    EMSP_NPT -->|3. Remote Start/Stop Command| CENTRAL_HUB
    EMSP_SH -->|3. Remote Start/Stop Command| CENTRAL_HUB
    CENTRAL_HUB -->|4. Forward Command| CPO_SIM
```

---

## User Interface Guide

### 1. Dashboard

![Dashboard](dashboard.png)

* **Core Function**: Displays the health, statistics, and active topology of the entire OCPI roaming network.
* **Key Sections**:
  * **Data Pipeline Flowchart**: Diagram illustrating the CPO Simulator -> Mock HUB -> eMSP Server roaming chain.
  * **Statistics Panel**: Includes current active chargers, total cumulative energy charged (kWh), net settlement amount (TWD), and AutoCharge authorization success rate.
  * **Data Exchange Topology Map**: Real-time visualization of how the TWCPO simulator (Taiwan control panel) forwards Sessions/CDRs data to specified eMSP tenants (e.g., NPT or SMARTHUBLCU) through the central hub.
  * **Active Sessions**: Displays details of all current active charging transactions.
  * **Real-time Logs (Right Side)**: Real-time output of OCPI protocol HTTP requests and routing engine dispatching status.

### 2. Charger Simulator

![Charger Simulator](CPO.png)

* **Core Function**: Simulates CPO charging stations, including status management, RFID card swiping, and AutoCharge scenarios.
* **Key Sections**:
  * **Station & EVSE Status Controls**: Select specific stations (e.g., "Wentao Station") and EVSEs (chargers), and manually update their status (e.g., setting a charger to Available).
  * **Scenario A: RFID Swiping**: Manually input a virtual RFID token (Token UID) and select the issuing eMSP to simulate a user swiping their card at a charger for authorization.
  * **Scenario B: AutoCharge Plug & Charge**: Simulate plugging in a vehicle to read its MAC address (e.g., Model Y LR's MAC) and automatically request authorization from the HUB/eMSP.
  * **Tariff & Custom Data Debugging**: Adjust the charging rate (TWD/kWh) in real-time, or edit and send the station's Location JSON and Tariff JSON data directly.

### 3. eMSP Simulator

![eMSP Simulator](emsp.png)

* **Core Function**: Simulates the mobile app backend used by EV drivers to send remote control commands and receive roaming bills.
* **Key Sections**:
  * **Switch eMSP Accounts**: View data from the perspective of different eMSP tenants.
  * **Remote Commands**:
    * **Remote START**: Target specific CPO stations and EVSEs, input token ID and auth reference, and send a start charging command.
    * **Remote STOP**: Send a stop charging command to active charging sessions.
  * **eMSP DB Logs**: Real-time display of active Sessions and finalized Charge Detail Records (CDRs) received from the central hub.

### 4. HUB Dashboard

![HUB Dashboard](hub.png)

* **Core Function**: Configures and manages routing for OCPI tenant connections.
* **Key Sections**:
  * **CPO List & Tokens**: Lists connected CPOs, their Country Code + Party ID mappings (e.g., TW + CPO or TW + EVZ), and connection credentials.
  * **Register CPO & eMSP Tenants**: Dynamically register new CPOs and eMSPs by inputting country code, party ID, tenant name, and connection tokens. The system automatically creates database routing paths.
