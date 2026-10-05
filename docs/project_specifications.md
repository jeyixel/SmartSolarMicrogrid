# Smart Solar Microgrid Trading System - Project Specifications

## 1. System Overview

The Smart Solar Microgrid Trading System is an enterprise-scale, end-to-end client-server application. It facilitates energy trading between solar prosumers (property owners with solar panel arrays) and microgrid site operators.

The system relies on a **FAT Service architecture**, meaning absolutely all business logic, validation, and rule enforcement resides centrally in the Web API. The Web and Mobile applications function strictly as user interface layers communicating via RESTful API calls.

## 2. Technology Stack & Architecture

* **Web Service (API):** C# Web API deployed on a Windows IIS Server.

* **Database:** Server-side NoSQL Database (MongoDB).

* **Web Application:** HTML/CSS/JS using Bootstrap 5, Tailwind CSS, or React.js.

* **Mobile Application:** **Pure Native Android** (No cross-platform frameworks like Flutter or React Native allowed).

* **Mobile Local Storage:** SQLite (for persisting local user management and authentication).

* **Third-Party Integrations:** Google Maps API (for plotting nodes), QR Code generation and scanning libraries.

## 3. Detailed System Functions

### A. Web Application (UI Layer)

The web portal serves Backoffice administrators and Grid Operators.

* **User Management & Access Control:**

  * Role-based access separating Backoffice (full admin) and Grid Operators (operational tools).

  * View and approve pending account activations.

* **Prosumer Management:**

  * Create, read, update, and deactivate prosumer profiles.

  * **Primary Key:** National Identity Card (NIC).

  * Deactivated accounts can exclusively be reactivated by a Backoffice officer.

* **Microgrid Node Management:**

  * Create new solar grid hubs specifying GPS locations, capacity specs (kW/h), and battery storage slots.

  * Update grid operational schedules.

  * *Constraint:* System must block node deactivation if there are active energy reservations tied to it.

* **Energy Slot Reservation Management:**

  * Backoffice/Grid Operators can manage power trading reservations.

  * *Business Rules:* Reservations must be scheduled within a 7-day window. Updates and cancellations mandate at least a 12-hour prior notice.

### B. Mobile Application (UI Layer)

The mobile app serves Solar Prosumers and Grid Operators on-site.

* **Prosumer Account Control:**

  * Registration using NIC as the primary identifier.

  * Edit profile data and submit account deactivation requests.

  * Local persistence via SQLite for login and reference data.

* **Reservation & QR Dispatch:**

  * Prosumers can reserve, modify, or cancel energy drop-off/charging slots (subject to the 12-hour/7-day rules enforced by the API).

  * Generates a secure transaction QR code upon reservation approval.

  * Immediate rendering of a summary page after any reservation action.

* **Dashboards & Mapping:**

  * Integration with **Google Maps API** to plot nearby grid nodes based on stored lat/long coordinates.

  * Clicking a map node displays station details.

  * Dashboard displaying active/pending reservation counts, future approved counts, full booking history, and search filters.

* **Operator Mode:**

  * Grid Operators can log in via the mobile app.

  * Features a scanner to read a prosumer's transaction QR code.

  * Verifies scanned data against the central server and triggers the API to finalize the energy transfer.

### C. Web Service (FAT Service API)

* **Centralized Logic:** All application intelligence sits here. Clients simply send requests and display responses.

* **Database Collections (Minimum required):**

  * `Users` (NIC, roles, status)

  * `SolarStationInfo` (GPS, capacity, battery slots)

  * `EnergyBookingSlots` (Reservation details, timestamps)

## 4. Team Task Allocation

To ensure parallel development and comprehensive coverage of the requirements, the project tasks are divided among the 4 team members as follows:

### Member 1: User Identity & Account Management

* **Database & API:** Develop the NoSQL user collections and C# Web API endpoints for authentication and role-based access.

* **Web App:** Build the login interfaces, Backoffice user creation, and prosumer profile management using the National Identity Card (NIC) as the primary key.

* **Mobile App:** Implement pure Android prosumer registration, profile editing, account deactivation requests, and SQLite local persistence for user authentication.

### Member 2: Microgrid Node & Location Services

* **Database & API:** Design the `SolarStationInfo` collection and APIs for grid hub data operations.

* **Web App:** Create interfaces to manage solar grid hubs, input GPS locations, configure capacity specs, and block node deactivations if active reservations exist.

* **Mobile App:** Integrate the Google Maps API to plot nearby grid nodes and display station details based on their stored latitude and longitude.

### Member 3: Reservation Workflow & Validation

* **Database & API:** Implement the `EnergyBookingSlots` collection and the FAT service business logic that strictly enforces the 7-day scheduling and 12-hour modification rules.

* **Web App:** Build the reservation management and schedule updating tools for Backoffice and Grid Operator users.

* **Mobile App:** Develop the UI for prosumers to reserve, modify, and cancel energy slots, ensuring a summary page accurately renders after every action.

### Member 4: Grid Operations, QR & Dashboards

* **Database & API:** Create data aggregation endpoints for dashboard statistics and secure QR verification logic.

* **Web App:** Build the pending activation views, booking history dashboards, and search filter criteria.

* **Mobile App:** Generate secure transaction QR codes for prosumers, and develop the Grid Operator scanner mode to read QR codes, verify server data, and finalize energy transfers.

### Shared Responsibilities (All Members)

* **Architecture Compliance:** Ensure all business logic exclusively resides in the central C# Web API, keeping both the Web and Android clients strictly as user interface layers.