/* =========================================================
   SCREEN TIME TRACKER PRO
   FULL CORRECTED SCRIPT.JS
   PART 1
========================================================= */

// ===============================
// APP STATE
// ===============================

let currentUser = null;

let total = 0;
let active = 0;
let idle = 0;

let idleLimit = 10;
let autoLogoutLimit = 60;

let lastActivity = Date.now();
let isIdle = false;
let idleStartTime = null;
let idleScreenshotTaken = false;

let focusSeconds = 25 * 60;
let focusRunning = false;

let mainChart = null;
let activityChartObj = null;
let weeklyChartObj = null;

let webcamStream = null;
let screenRecorder = null;
let recordedScreenChunks = [];

// ===============================
// DOM HELPER
// ===============================

function $(id) {
  return document.getElementById(id);
}

// ===============================
// STORAGE HELPERS
// ===============================

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem("users")) || [];
  } catch (error) {
    console.error("Users data read error:", error);
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("idleHistory")) || [];
  } catch (error) {
    console.error("History data read error:", error);
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(
    "idleHistory",
    JSON.stringify(history)
  );
}

function getToday() {
  return new Date().toLocaleDateString();
}

function getCurrentLoggedUser() {
  const username =
    currentUser ||
    localStorage.getItem("currentUser");

  return getUsers().find(
    user => user.username === username
  );
}

// ===============================
// PASSWORD HASH
// ===============================

function hashPassword(password) {
  let hash = 0;

  for (let i = 0; i < password.length; i++) {
    hash =
      (hash << 5) -
      hash +
      password.charCodeAt(i);

    hash |= 0;
  }

  return hash.toString();
}

// ===============================
// SAFE TEXT
// ===============================

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeFeatureText(value) {
  return escapeHTML(value);
}

// ===============================
// LOGIN AND REGISTER UI
// ===============================

function showLogin() {
  const loginBox = $("loginBox");
  const registerBox = $("registerBox");

  if (loginBox) {
    loginBox.classList.remove("hidden");
  }

  if (registerBox) {
    registerBox.classList.add("hidden");
  }
}

function showRegister() {
  const loginBox = $("loginBox");
  const registerBox = $("registerBox");

  if (registerBox) {
    registerBox.classList.remove("hidden");
  }

  if (loginBox) {
    loginBox.classList.add("hidden");
  }
}

// ===============================
// REGISTER
// ===============================

function register() {
  const usernameInput = $("regUser");
  const passwordInput = $("regPass");
  const roleInput = $("regRole");

  if (
    !usernameInput ||
    !passwordInput ||
    !roleInput
  ) {
    alert("Register form elements not found");
    return;
  }

  const username =
    usernameInput.value.trim();

  const password =
    passwordInput.value.trim();

  const role =
    roleInput.value;

  if (username === "" || password === "") {
    alert("Please enter username and password");
    return;
  }

  if (username.length < 3) {
    alert("Username must contain at least 3 characters");
    return;
  }

  if (password.length < 4) {
    alert("Password must contain at least 4 characters");
    return;
  }

  const users = getUsers();

  const alreadyExists =
    users.some(
      user =>
        user.username.toLowerCase() ===
        username.toLowerCase()
    );

  if (alreadyExists) {
    alert("Username already exists");
    return;
  }

  users.push({
    username: username,
    password: hashPassword(password),
    role: role,

    total: 0,
    active: 0,
    idle: 0,

    activity: "Study",

    activityData: {
      Study: 0,
      Coding: 0,
      YouTube: 0,
      Gaming: 0,
      "Social Media": 0,
      Other: 0
    },

    weeklyData: [
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],

    goalMinutes: 120,
    streak: 0,

    lastGoalDate: null,

    inbox: [],

    createdAt:
      new Date().toLocaleString()
  });

  saveUsers(users);

  usernameInput.value = "";
  passwordInput.value = "";

  alert("✅ Register successful. Login now.");

  showLogin();
}

// ===============================
// LOGIN
// ===============================

function login() {
  const usernameInput = $("loginUser");
  const passwordInput = $("loginPass");
  const roleInput = $("loginRole");

  if (
    !usernameInput ||
    !passwordInput ||
    !roleInput
  ) {
    alert("Login form elements not found");
    return;
  }

  const username =
    usernameInput.value.trim();

  const password =
    passwordInput.value.trim();

  const role =
    roleInput.value;

  if (username === "" || password === "") {
    alert("Please enter username and password");
    return;
  }

  const users = getUsers();

  const foundUser =
    users.find(user =>
      user.username === username &&
      user.password === hashPassword(password) &&
      user.role === role
    );

  if (!foundUser) {
    alert(
      "❌ Invalid username, password or role"
    );

    return;
  }

  currentUser = foundUser.username;

  localStorage.setItem(
    "currentUser",
    foundUser.username
  );

  localStorage.setItem(
    "currentRole",
    foundUser.role
  );

  lastActivity = Date.now();
  isIdle = false;
  idleScreenshotTaken = false;

  const authBox = $("authBox");
  const dashboard = $("dashboard");

  if (authBox) {
    authBox.classList.add("hidden");
  }

  if (dashboard) {
    dashboard.classList.remove("hidden");
  }

  recordSessionHistory(
    "Login: " +
    foundUser.username +
    " - " +
    new Date().toLocaleString()
  );

  loadUser();

  alert("✅ Login Successful");
}

// ===============================
// LOGOUT
// ===============================

function logout() {
  if (currentUser) {
    recordSessionHistory(
      "Logout: " +
      currentUser +
      " - " +
      new Date().toLocaleString()
    );
  }

  stopWebcam();

  if (
    screenRecorder &&
    screenRecorder.state === "recording"
  ) {
    screenRecorder.stop();
  }

  currentUser = null;

  total = 0;
  active = 0;
  idle = 0;

  isIdle = false;
  idleScreenshotTaken = false;

  localStorage.removeItem("currentUser");
  localStorage.removeItem("currentRole");

  const dashboard = $("dashboard");
  const authBox = $("authBox");
  const adminPanel = $("adminPanel");

  if (dashboard) {
    dashboard.classList.add("hidden");
  }

  if (adminPanel) {
    adminPanel.classList.add("hidden");
  }

  if (authBox) {
    authBox.classList.remove("hidden");
  }

  showLogin();
}

// ===============================
// LOAD CURRENT USER
// ===============================

function loadUser() {
  const user = getUsers().find(
    item => item.username === currentUser
  );

  if (!user) {
    logout();
    return;
  }

  ensureUserData(user);

  total = Number(user.total) || 0;
  active = Number(user.active) || 0;
  idle = Number(user.idle) || 0;

  const activitySelect = $("activity");
  const goalInput = $("goalInput");
  const welcome = $("welcome");
  const adminPanel = $("adminPanel");

  if (activitySelect) {
    activitySelect.value =
      user.activity || "Study";
  }

  if (goalInput) {
    goalInput.value =
      user.goalMinutes || 120;
  }

  if (welcome) {
    welcome.innerText =
      "Welcome, " +
      user.username +
      " (" +
      user.role +
      ")";
  }

  if (
    user.role === "Admin" &&
    adminPanel
  ) {
    adminPanel.classList.remove("hidden");
    loadAdmin();
  } else if (adminPanel) {
    adminPanel.classList.add("hidden");
  }

  loadInbox();
  updateDisplay();
  createCharts();
  loadHistoryTable();
}

// ===============================
// USER DEFAULT DATA
// ===============================

function ensureUserData(user) {
  if (!user.activityData) {
    user.activityData = {
      Study: 0,
      Coding: 0,
      YouTube: 0,
      Gaming: 0,
      "Social Media": 0,
      Other: 0
    };
  }

  if (!Array.isArray(user.weeklyData)) {
    user.weeklyData = [
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ];
  }

  if (!Array.isArray(user.inbox)) {
    user.inbox = [];
  }

  if (!user.activity) {
    user.activity = "Study";
  }

  if (!user.goalMinutes) {
    user.goalMinutes = 120;
  }

  if (!user.streak) {
    user.streak = 0;
  }
}

// ===============================
// SAVE CURRENT USER
// ===============================

function saveCurrentUser() {
  if (!currentUser) {
    return;
  }

  const activitySelect = $("activity");

  let users = getUsers();

  users = users.map(user => {
    if (user.username === currentUser) {
      ensureUserData(user);

      user.total = total;
      user.active = active;
      user.idle = idle;

      user.activity =
        activitySelect
          ? activitySelect.value
          : user.activity || "Study";

      if (
        typeof user.activityData[
          user.activity
        ] !== "number"
      ) {
        user.activityData[
          user.activity
        ] = 0;
      }

      user.activityData[
        user.activity
      ]++;

      const dayIndex =
        new Date().getDay();

      user.weeklyData[
        dayIndex
      ] =
        (Number(
          user.weeklyData[dayIndex]
        ) || 0) + 1;

      checkGoal(user);
    }

    return user;
  });

  saveUsers(users);
}

// ===============================
// DAILY GOAL
// ===============================

function checkGoal(user) {
  const goalSeconds =
    (Number(user.goalMinutes) || 120) *
    60;

  if (
    Number(user.active) >= goalSeconds &&
    user.lastGoalDate !== getToday()
  ) {
    user.streak =
      (Number(user.streak) || 0) + 1;

    user.lastGoalDate = getToday();

    alert(
      "🎉 Daily goal completed! Streak increased."
    );
  }
}

function saveGoal() {
  const goalInput = $("goalInput");

  if (!goalInput) {
    return;
  }

  const goal =
    Number(goalInput.value);

  if (!goal || goal <= 0) {
    alert(
      "Please enter a valid goal in minutes"
    );

    return;
  }

  let users = getUsers();

  users = users.map(user => {
    if (user.username === currentUser) {
      user.goalMinutes = goal;
    }

    return user;
  });

  saveUsers(users);

  alert("Daily goal saved");

  updateDisplay();
}

// ===============================
// SCORE CALCULATION
// ===============================

function scoreCalc(activeTime, totalTime) {
  const safeActive =
    Number(activeTime) || 0;

  const safeTotal =
    Number(totalTime) || 0;

  if (safeTotal <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round(
      (safeActive / safeTotal) * 100
    )
  );
}

// ===============================
// UPDATE DASHBOARD DISPLAY
// ===============================

function updateDisplay() {
  const user =
    getCurrentLoggedUser();

  if (!user) {
    return;
  }

  const goalSeconds =
    (Number(user.goalMinutes) || 120) *
    60;

  const goalPercent =
    goalSeconds > 0
      ? Math.min(
          Math.round(
            (active / goalSeconds) * 100
          ),
          100
        )
      : 0;

  if ($("total")) {
    $("total").innerText =
      total + " sec";
  }

  if ($("active")) {
    $("active").innerText =
      active + " sec";
  }

  if ($("idle")) {
    $("idle").innerText =
      idle + " sec";
  }

  if ($("score")) {
    $("score").innerText =
      scoreCalc(active, total) + "%";
  }

  if ($("goalStatus")) {
    $("goalStatus").innerText =
      goalPercent + "%";
  }

  if ($("streak")) {
    $("streak").innerText =
      (Number(user.streak) || 0) +
      " days";
  }

  updateCharts();
}

// ===============================
// RESET USER DATA
// ===============================

function resetMe() {
  const confirmation =
    confirm(
      "Are you sure you want to reset your data?"
    );

  if (!confirmation) {
    return;
  }

  total = 0;
  active = 0;
  idle = 0;

  let users = getUsers();

  users = users.map(user => {
    if (user.username === currentUser) {
      ensureUserData(user);

      user.total = 0;
      user.active = 0;
      user.idle = 0;

      user.activityData = {
        Study: 0,
        Coding: 0,
        YouTube: 0,
        Gaming: 0,
        "Social Media": 0,
        Other: 0
      };

      user.weeklyData = [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ];

      user.streak = 0;
      user.lastGoalDate = null;
    }

    return user;
  });

  saveUsers(users);

  updateDisplay();
  createCharts();

  if (
    localStorage.getItem("currentRole") ===
    "Admin"
  ) {
    loadAdmin();
  }

  alert("User data reset successfully");
}

// ===============================
// ADMIN PANEL
// ===============================

function loadAdmin() {
  if (!currentUser) {
    return;
  }

  const users = getUsers();

  const adminUser =
    users.find(
      user =>
        user.username === currentUser
    );

  if (
    !adminUser ||
    adminUser.role !== "Admin"
  ) {
    return;
  }

  const searchUser = $("searchUser");
  const userTable = $("userTable");
  const activityTable =
    $("activityTable");

  if (!userTable || !activityTable) {
    return;
  }

  const searchText =
    searchUser
      ? searchUser.value
          .trim()
          .toLowerCase()
      : "";

  userTable.innerHTML = "";
  activityTable.innerHTML = "";

  const filteredUsers =
    users.filter(user =>
      user.username
        .toLowerCase()
        .includes(searchText)
    );

  if (filteredUsers.length === 0) {
    userTable.innerHTML = `
      <tr>
        <td colspan="9">
          No users found
        </td>
      </tr>
    `;

    activityTable.innerHTML = `
      <tr>
        <td colspan="4">
          No activity found
        </td>
      </tr>
    `;

    loadLeaderboard(users);
    loadIdleScreenshots();

    return;
  }

  filteredUsers.forEach(user => {
    ensureUserData(user);

    const totalTime =
      Number(user.total) || 0;

    const activeTime =
      Number(user.active) || 0;

    const idleTime =
      Number(user.idle) || 0;

    const productivity =
      scoreCalc(
        activeTime,
        totalTime
      );

    userTable.innerHTML += `
      <tr>
        <td>
          ${escapeHTML(user.username)}
        </td>

        <td>
          ${escapeHTML(user.role)}
        </td>

        <td>
          ${totalTime} sec
        </td>

        <td>
          ${activeTime} sec
        </td>

        <td>
          ${idleTime} sec
        </td>

        <td>
          ${escapeHTML(
            user.activity || "Study"
          )}
        </td>

        <td>
          ${Number(
            user.goalMinutes
          ) || 120} min
        </td>

        <td>
          ${Number(
            user.streak
          ) || 0} days
        </td>

        <td>
          ${productivity}%
        </td>
      </tr>
    `;

    Object.keys(
      user.activityData
    ).forEach(activityName => {
      activityTable.innerHTML += `
        <tr>
          <td>
            ${escapeHTML(
              user.username
            )}
          </td>

          <td>
            ${escapeHTML(
              activityName
            )}
          </td>

          <td>
            ${
              Number(
                user.activityData[
                  activityName
                ]
              ) || 0
            } sec
          </td>

          <td>
            <button
              type="button"
              class="delete-btn"
              onclick="deleteActivity(
                '${escapeJavaScriptText(
                  user.username
                )}',
                '${escapeJavaScriptText(
                  activityName
                )}'
              )"
            >
              🗑 Remove
            </button>
          </td>
        </tr>
      `;
    });
  });

  loadLeaderboard(users);
  loadIdleScreenshots();
}

// ===============================
// SAFE JAVASCRIPT STRING
// ===============================

function escapeJavaScriptText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
}

// ===============================
// DELETE ACTIVITY
// ===============================

function deleteActivity(
  username,
  activityName
) {
  const confirmation =
    confirm(
      "Are you sure you want to remove this activity?"
    );

  if (!confirmation) {
    return;
  }

  let users = getUsers();

  users = users.map(user => {
    if (user.username === username) {
      ensureUserData(user);

      if (
        Object.prototype.hasOwnProperty.call(
          user.activityData,
          activityName
        )
      ) {
        delete user.activityData[
          activityName
        ];
      }

      if (
        user.activity === activityName
      ) {
        user.activity = "Study";
      }
    }

    return user;
  });

  saveUsers(users);

  alert(
    "Activity removed successfully"
  );

  loadAdmin();

  if (username === currentUser) {
    loadUser();
  }
}

// ===============================
// LEADERBOARD
// ===============================

function loadLeaderboard(users) {
  const leaderboard =
    $("leaderboard");

  if (!leaderboard) {
    return;
  }

  leaderboard.innerHTML = "";

  const sortedUsers =
    [...users].sort(
      (a, b) =>
        scoreCalc(
          b.active || 0,
          b.total || 0
        ) -
        scoreCalc(
          a.active || 0,
          a.total || 0
        )
    );

  if (sortedUsers.length === 0) {
    leaderboard.innerHTML =
      "<li>No users found</li>";

    return;
  }

  sortedUsers.forEach(user => {
    leaderboard.innerHTML += `
      <li>
        ${escapeHTML(user.username)}
        -
        ${scoreCalc(
          user.active || 0,
          user.total || 0
        )}%
      </li>
    `;
  });
}
// ===============================
// ADMIN MESSAGE TO ONE USER
// ===============================

function sendMessage() {
  const messageUser =
    $("messageUser");

  const adminMessage =
    $("adminMessage");

  if (!messageUser || !adminMessage) {
    alert(
      "Message user or message box not found"
    );

    return;
  }

  const targetUsername =
    messageUser.value.trim();

  const message =
    adminMessage.value.trim();

  if (
    targetUsername === "" ||
    message === ""
  ) {
    alert(
      "Please enter username and message"
    );

    return;
  }

  const admin =
    getCurrentLoggedUser();

  if (
    !admin ||
    admin.role !== "Admin"
  ) {
    alert(
      "Only Admin can send messages"
    );

    return;
  }

  let found = false;

  let users = getUsers();

  users = users.map(user => {
    if (
      user.username.toLowerCase() ===
      targetUsername.toLowerCase()
    ) {
      ensureUserData(user);

      user.inbox.unshift({
        message: message,
        sender: currentUser,
        type: "individual",
        time:
          new Date().toLocaleString()
      });

      found = true;
    }

    return user;
  });

  if (!found) {
    alert("User not found");
    return;
  }

  saveUsers(users);

  adminMessage.value = "";

  alert("Message sent successfully");
}

// ===============================
// SEND MESSAGE TO ALL USERS
// ===============================

function sendMessageToAllUsers() {
  const messageBox =
    $("broadcastMessage");

  if (!messageBox) {
    alert(
      "Broadcast message box not found"
    );

    return;
  }

  const message =
    messageBox.value.trim();

  if (message === "") {
    alert(
      "Please enter a message"
    );

    return;
  }

  const admin =
    getCurrentLoggedUser();

  if (
    !admin ||
    admin.role !== "Admin"
  ) {
    alert(
      "Only Admin can send broadcast messages"
    );

    return;
  }

  let receiverCount = 0;

  let users = getUsers();

  users = users.map(user => {
    ensureUserData(user);

    if (user.role !== "Admin") {
      user.inbox.unshift({
        message: message,
        sender: currentUser,
        type: "broadcast",
        time:
          new Date().toLocaleString()
      });

      receiverCount++;
    }

    return user;
  });

  saveUsers(users);

  messageBox.value = "";

  alert(
    "Message sent successfully to " +
    receiverCount +
    " users"
  );
}

// ===============================
// USER INBOX
// ===============================

function loadInbox() {
  const user =
    getCurrentLoggedUser();

  const inboxList =
    $("inboxList");

  if (!user || !inboxList) {
    return;
  }

  ensureUserData(user);

  inboxList.innerHTML = "";

  if (user.inbox.length === 0) {
    inboxList.innerHTML = `
      <li class="empty-inbox">
        No messages
      </li>
    `;

    return;
  }

  user.inbox.forEach(
    (messageData, index) => {
      let title =
        "⚠ Admin Message";

      if (
        messageData.type ===
        "broadcast"
      ) {
        title =
          "📢 Admin Broadcast";
      }

      if (
        messageData.type ===
        "idle-screenshot"
      ) {
        title =
          "📸 Idle Screenshot Alert";
      }

      inboxList.innerHTML += `
        <li class="inbox-message">

          <div class="message-content">

            <strong>
              ${title}
            </strong>

            <p>
              ${escapeHTML(
                messageData.message
              )}
            </p>

            <small>
              From:
              ${escapeHTML(
                messageData.sender ||
                "Admin"
              )}
              |
              ${escapeHTML(
                messageData.time || ""
              )}
            </small>

          </div>

          <button
            type="button"
            class="inbox-delete-btn"
            onclick="deleteInboxMessage(
              ${index}
            )"
          >
            🗑 Delete
          </button>

        </li>
      `;
    }
  );
}

// ===============================
// DELETE INBOX MESSAGE
// ===============================

function deleteInboxMessage(index) {
  const confirmation =
    confirm(
      "Delete this message?"
    );

  if (!confirmation) {
    return;
  }

  let users = getUsers();

  users = users.map(user => {
    if (
      user.username === currentUser
    ) {
      ensureUserData(user);

      if (
        index >= 0 &&
        index < user.inbox.length
      ) {
        user.inbox.splice(
          index,
          1
        );
      }
    }

    return user;
  });

  saveUsers(users);

  loadInbox();
}

// ===============================
// REPORT SEARCH HELPER
// ===============================

function getSearchedUsersForReport() {
  const searchBox =
    $("searchUser");

  const searchName =
    searchBox
      ? searchBox.value
          .trim()
          .toLowerCase()
      : "";

  const users = getUsers();

  if (searchName === "") {
    alert(
      "Please enter a username in the search box"
    );

    return [];
  }

  const matchedUsers =
    users.filter(user =>
      user.username
        .toLowerCase() ===
      searchName
    );

  if (matchedUsers.length === 0) {
    alert(
      "No user found with username: " +
      searchName
    );

    return [];
  }

  return matchedUsers;
}

// ===============================
// USER REPORT CSV
// ===============================

function downloadUserReport() {
  const matchedUsers =
    getSearchedUsersForReport();

  if (matchedUsers.length === 0) {
    return;
  }

  let csv =
    "Username,Role,Total Time,Active Time,Idle Time,Current Activity,Goal Minutes,Streak,Productivity\n";

  matchedUsers.forEach(user => {
    csv +=
      csvValue(user.username) + "," +
      csvValue(user.role) + "," +
      csvValue(user.total || 0) + "," +
      csvValue(user.active || 0) + "," +
      csvValue(user.idle || 0) + "," +
      csvValue(
        user.activity || "Study"
      ) + "," +
      csvValue(
        user.goalMinutes || 120
      ) + "," +
      csvValue(
        user.streak || 0
      ) + "," +
      csvValue(
        scoreCalc(
          user.active || 0,
          user.total || 0
        ) + "%"
      ) +
      "\n";
  });

  const safeUsername =
    matchedUsers[0].username
      .replace(
        /[^a-z0-9]/gi,
        "_"
      );

  downloadCSV(
    csv,
    safeUsername +
      "_user_report.csv"
  );
}

// ===============================
// ACTIVITY REPORT CSV
// ===============================

function downloadActivityReport() {
  const matchedUsers =
    getSearchedUsersForReport();

  if (matchedUsers.length === 0) {
    return;
  }

  let csv =
    "Username,Activity,Time Spent Seconds\n";

  matchedUsers.forEach(user => {
    ensureUserData(user);

    Object.keys(
      user.activityData
    ).forEach(activityName => {
      csv +=
        csvValue(user.username) + "," +
        csvValue(activityName) + "," +
        csvValue(
          user.activityData[
            activityName
          ] || 0
        ) +
        "\n";
    });
  });

  const safeUsername =
    matchedUsers[0].username
      .replace(
        /[^a-z0-9]/gi,
        "_"
      );

  downloadCSV(
    csv,
    safeUsername +
      "_activity_report.csv"
  );
}

// ===============================
// CSV SAFE VALUE
// ===============================

function csvValue(value) {
  return (
    '"' +
    String(value ?? "")
      .replace(/"/g, '""') +
    '"'
  );
}

// ===============================
// DOWNLOAD ALL USER DATA CSV
// ===============================

function exportCSV() {
  const users =
    getUsers();

  let csv =
    "Username,Role,Total,Active,Idle,Activity,Goal,Streak,Score\n";

  users.forEach(user => {
    csv +=
      csvValue(user.username) + "," +
      csvValue(user.role) + "," +
      csvValue(user.total || 0) + "," +
      csvValue(user.active || 0) + "," +
      csvValue(user.idle || 0) + "," +
      csvValue(
        user.activity || "Study"
      ) + "," +
      csvValue(
        user.goalMinutes || 120
      ) + "," +
      csvValue(
        user.streak || 0
      ) + "," +
      csvValue(
        scoreCalc(
          user.active || 0,
          user.total || 0
        ) + "%"
      ) +
      "\n";
  });

  downloadCSV(
    csv,
    "screen_time_report.csv"
  );
}

// ===============================
// CSV DOWNLOAD
// ===============================

function downloadCSV(
  content,
  filename
) {
  downloadFile(
    content,
    filename,
    "text/csv;charset=utf-8"
  );
}

// ===============================
// GENERAL FILE DOWNLOAD
// ===============================

function downloadFile(
  content,
  filename,
  type
) {
  const blob =
    new Blob(
      [content],
      { type: type }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

// ===============================
// BACKUP DATA
// ===============================

function backupData() {
  const data = {
    users: getUsers(),
    idleHistory: getHistory(),
    idleScreenshots:
      getIdleScreenshots(),
    sessionHistory:
      getSessionHistory(),
    backupDate:
      new Date().toLocaleString()
  };

  downloadFile(
    JSON.stringify(
      data,
      null,
      2
    ),
    "screen_time_backup.json",
    "application/json"
  );
}

// ===============================
// RESTORE DATA
// ===============================

function restoreData(event) {
  const file =
    event.target.files[0];

  if (!file) {
    return;
  }

  const reader =
    new FileReader();

  reader.onload =
    function (readerEvent) {
      try {
        const data =
          JSON.parse(
            readerEvent.target.result
          );

        if (
          !Array.isArray(data.users)
        ) {
          throw new Error(
            "Invalid users data"
          );
        }

        localStorage.setItem(
          "users",
          JSON.stringify(
            data.users || []
          )
        );

        localStorage.setItem(
          "idleHistory",
          JSON.stringify(
            data.idleHistory || []
          )
        );

        localStorage.setItem(
          "idleScreenshots",
          JSON.stringify(
            data.idleScreenshots || []
          )
        );

        localStorage.setItem(
          "sessionHistory",
          JSON.stringify(
            data.sessionHistory || []
          )
        );

        alert(
          "Data restored successfully"
        );

        location.reload();
      } catch (error) {
        console.error(error);

        alert(
          "Invalid backup file"
        );
      }
    };

  reader.readAsText(file);
}

// ===============================
// SESSION HISTORY
// ===============================

function getSessionHistory() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "sessionHistory"
      )
    ) || [];
  } catch (error) {
    return [];
  }
}

function recordSessionHistory(message) {
  const history =
    getSessionHistory();

  history.push(message);

  const limitedHistory =
    history.slice(-50);

  localStorage.setItem(
    "sessionHistory",
    JSON.stringify(
      limitedHistory
    )
  );
}

// ===============================
// IDLE SCREENSHOT STORAGE
// ===============================

function getIdleScreenshots() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "idleScreenshots"
      )
    ) || [];
  } catch (error) {
    console.error(
      "Screenshot data read error:",
      error
    );

    return [];
  }
}

function saveIdleScreenshots(
  screenshots
) {
  try {
    const limitedScreenshots =
      screenshots.slice(0, 10);

    localStorage.setItem(
      "idleScreenshots",
      JSON.stringify(
        limitedScreenshots
      )
    );
  } catch (error) {
    console.error(
      "Screenshot save error:",
      error
    );

    alert(
      "Screenshot storage is full. Delete old screenshots."
    );
  }
}

// ===============================
// CAPTURE IDLE SCREENSHOT
// ===============================

async function captureIdleScreenshot() {
  if (!currentUser) {
    return;
  }

  if (
    typeof html2canvas ===
    "undefined"
  ) {
    console.error(
      "html2canvas library not loaded"
    );

    return;
  }

  const dashboardElement =
    $("dashboard");

  if (!dashboardElement) {
    console.error(
      "Dashboard element not found"
    );

    return;
  }

  const adminPanel =
    $("adminPanel");

  const previousDisplay =
    adminPanel
      ? adminPanel.style.display
      : "";

  try {
    if (adminPanel) {
      adminPanel.style.display =
        "none";
    }

    const canvas =
      await html2canvas(
        dashboardElement,
        {
          backgroundColor:
            "#ffffff",

          scale: 0.6,

          useCORS: true,

          logging: false,

          windowWidth:
            document
              .documentElement
              .scrollWidth,

          windowHeight:
            document
              .documentElement
              .scrollHeight
        }
      );

    const screenshotData =
      canvas.toDataURL(
        "image/jpeg",
        0.55
      );

    const screenshots =
      getIdleScreenshots();

    screenshots.unshift({
      id:
        Date.now() +
        "_" +
        Math.random()
          .toString(36)
          .slice(2),

      username: currentUser,

      capturedAt:
        new Date()
          .toLocaleString(),

      totalTime: total,

      activeTime: active,

      idleTime: idle,

      status: "Idle",

      image: screenshotData
    });

    saveIdleScreenshots(
      screenshots
    );

    sendIdleScreenshotNotificationToAdmins(
      currentUser
    );

    console.log(
      "Idle screenshot captured successfully"
    );
  } catch (error) {
    console.error(
      "Idle screenshot capture failed:",
      error
    );
  } finally {
    if (adminPanel) {
      adminPanel.style.display =
        previousDisplay;
    }
  }
}

// ===============================
// IDLE SCREENSHOT ADMIN MESSAGE
// ===============================

function sendIdleScreenshotNotificationToAdmins(
  username
) {
  let users = getUsers();

  users = users.map(user => {
    if (user.role === "Admin") {
      ensureUserData(user);

      user.inbox.unshift({
        message:
          username +
          " became idle. An automatic screenshot was captured.",

        sender: "System",

        type:
          "idle-screenshot",

        time:
          new Date()
            .toLocaleString()
      });
    }

    return user;
  });

  saveUsers(users);
}

// ===============================
// LOAD IDLE SCREENSHOTS
// ===============================

function loadIdleScreenshots() {
  const list =
    $("idleScreenshotList");

  if (!list) {
    return;
  }

  const searchBox =
    $("searchUser");

  const searchName =
    searchBox
      ? searchBox.value
          .trim()
          .toLowerCase()
      : "";

  let screenshots =
    getIdleScreenshots();

  if (searchName !== "") {
    screenshots =
      screenshots.filter(item =>
        String(
          item.username
        )
          .toLowerCase()
          .includes(searchName)
      );
  }

  list.innerHTML = "";

  if (
    screenshots.length === 0
  ) {
    list.innerHTML = `
      <p>
        No idle screenshots found.
      </p>
    `;

    return;
  }

  screenshots.forEach(item => {
    const card =
      document.createElement(
        "div"
      );

    card.className =
      "idle-screenshot-card";

    card.innerHTML = `
      <div class="idle-screenshot-info">

        <h4>
          👤
          ${escapeHTML(
            item.username
          )}
        </h4>

        <p>
          <strong>Status:</strong>
          ${escapeHTML(
            item.status
          )}
        </p>

        <p>
          <strong>Captured:</strong>
          ${escapeHTML(
            item.capturedAt
          )}
        </p>

        <p>
          <strong>Total:</strong>
          ${Number(
            item.totalTime
          ) || 0}
          sec
        </p>

        <p>
          <strong>Active:</strong>
          ${Number(
            item.activeTime
          ) || 0}
          sec
        </p>

        <p>
          <strong>Idle:</strong>
          ${Number(
            item.idleTime
          ) || 0}
          sec
        </p>

      </div>

      <img
        src="${item.image}"
        alt="Idle screenshot"
        onclick="openIdleScreenshot(
          '${escapeJavaScriptText(
            item.id
          )}'
        )"
      >

      <div class="idle-screenshot-actions">

        <button
          type="button"
          class="view-screenshot-btn"
          onclick="openIdleScreenshot(
            '${escapeJavaScriptText(
              item.id
            )}'
          )"
        >
          👁 View
        </button>

        <button
          type="button"
          class="download-screenshot-btn"
          onclick="downloadIdleScreenshot(
            '${escapeJavaScriptText(
              item.id
            )}'
          )"
        >
          ⬇ Download
        </button>

        <button
          type="button"
          class="delete-screenshot-btn"
          onclick="deleteIdleScreenshot(
            '${escapeJavaScriptText(
              item.id
            )}'
          )"
        >
          🗑 Delete
        </button>

      </div>
    `;

    list.appendChild(card);
  });
}

// ===============================
// OPEN IDLE SCREENSHOT
// ===============================

function openIdleScreenshot(id) {
  const screenshot =
    getIdleScreenshots()
      .find(
        item => item.id === id
      );

  if (!screenshot) {
    alert(
      "Screenshot not found"
    );

    return;
  }

  const newWindow =
    window.open("", "_blank");

  if (!newWindow) {
    alert(
      "Popup blocked. Please allow popups."
    );

    return;
  }

  newWindow.document.write(`
    <!DOCTYPE html>

    <html>

    <head>

      <meta charset="UTF-8">

      <title>
        Idle Screenshot
      </title>

      <style>

        body {
          margin: 0;
          padding: 20px;
          background: #111827;
          color: white;
          font-family: Arial, sans-serif;
          text-align: center;
        }

        img {
          display: block;
          max-width: 100%;
          max-height: 85vh;
          margin: 20px auto;
          border-radius: 12px;
        }

      </style>

    </head>

    <body>

      <h2>
        ${escapeHTML(
          screenshot.username
        )}
        - Idle Screenshot
      </h2>

      <p>
        ${escapeHTML(
          screenshot.capturedAt
        )}
      </p>

      <img
        src="${screenshot.image}"
        alt="Idle Screenshot"
      >

    </body>

    </html>
  `);

  newWindow.document.close();
}

// ===============================
// DOWNLOAD IDLE SCREENSHOT
// ===============================

function downloadIdleScreenshot(id) {
  const screenshot =
    getIdleScreenshots()
      .find(
        item => item.id === id
      );

  if (!screenshot) {
    alert(
      "Screenshot not found"
    );

    return;
  }

  const safeUsername =
    String(
      screenshot.username
    ).replace(
      /[^a-z0-9]/gi,
      "_"
    );

  const link =
    document.createElement("a");

  link.href =
    screenshot.image;

  link.download =
    safeUsername +
    "_idle_" +
    Date.now() +
    ".jpg";

  document.body.appendChild(link);

  link.click();

  link.remove();
}

// ===============================
// DELETE IDLE SCREENSHOT
// ===============================

function deleteIdleScreenshot(id) {
  const confirmation =
    confirm(
      "Delete this idle screenshot?"
    );

  if (!confirmation) {
    return;
  }

  let screenshots =
    getIdleScreenshots();

  screenshots =
    screenshots.filter(
      item => item.id !== id
    );

  saveIdleScreenshots(
    screenshots
  );

  loadIdleScreenshots();
}

// ===============================
// CLEAR ALL IDLE SCREENSHOTS
// ===============================

function clearAllIdleScreenshots() {
  const confirmation =
    confirm(
      "Delete all idle screenshots?"
    );

  if (!confirmation) {
    return;
  }

  localStorage.removeItem(
    "idleScreenshots"
  );

  loadIdleScreenshots();

  alert(
    "All idle screenshots deleted"
  );
}
// ===============================
// IDLE / ACTIVITY TRACKING
// ===============================

function activityDetected() {
  lastActivity = Date.now();

  if (isIdle) {
    isIdle = false;
    idleScreenshotTaken = false;

    const history = getHistory();

    history.push({
      user: currentUser,
      idleTime: idleStartTime,
      activeAgain:
        new Date().toLocaleString()
    });

    saveHistory(
      history.slice(-50)
    );

    const statusText =
      $("statusText");

    const alertMessage =
      $("alertMsg");

    const statusBox =
      document.querySelector(
        ".status"
      );

    if (statusText) {
      statusText.innerText =
        "Active";

      statusText.style.color =
        "green";
    }

    if (alertMessage) {
      alertMessage.innerText =
        "User active again";
    }

    if (statusBox) {
      statusBox.style.background =
        "#dcfce7";
    }

    loadHistoryTable();
  }
}

document.addEventListener(
  "mousemove",
  activityDetected
);

document.addEventListener(
  "keydown",
  activityDetected
);

document.addEventListener(
  "click",
  activityDetected
);

document.addEventListener(
  "scroll",
  activityDetected
);

document.addEventListener(
  "touchstart",
  activityDetected
);

// ===============================
// MAIN SCREEN TIME TIMER
// ===============================

setInterval(() => {
  if (!currentUser) {
    return;
  }

  total++;

  const inactiveTime =
    Math.floor(
      (
        Date.now() -
        lastActivity
      ) / 1000
    );

  const statusText =
    $("statusText");

  const alertMessage =
    $("alertMsg");

  const statusBox =
    document.querySelector(
      ".status"
    );

  if (
    inactiveTime >= idleLimit
  ) {
    idle++;

    if (statusText) {
      statusText.innerText =
        "Idle";

      statusText.style.color =
        "red";
    }

    if (alertMessage) {
      alertMessage.innerText =
        "⚠ Screen idle. Admin and user notified.";
    }

    if (statusBox) {
      statusBox.style.background =
        "#fee2e2";
    }

    if (!isIdle) {
      isIdle = true;

      idleStartTime =
        new Date().toLocaleString();

      playSound();

      notify(
        "Screen Time Tracker",
        "Your screen is idle!"
      );

      if (
        !idleScreenshotTaken
      ) {
        idleScreenshotTaken =
          true;

        setTimeout(() => {
          captureIdleScreenshot();
        }, 800);
      }
    }

    if (
      inactiveTime >=
      autoLogoutLimit
    ) {
      alert(
        "Auto logout due to long idle time"
      );

      logout();

      return;
    }
  } else {
    active++;

    if (statusText) {
      statusText.innerText =
        "Active";

      statusText.style.color =
        "green";
    }

    if (alertMessage) {
      alertMessage.innerText =
        "Screen is active";
    }

    if (statusBox) {
      statusBox.style.background =
        "#dcfce7";
    }
  }

  saveCurrentUser();
  updateDisplay();

  if (
    localStorage.getItem(
      "currentRole"
    ) === "Admin"
  ) {
    loadAdmin();
  }
}, 1000);

// ===============================
// CHART CREATION
// ===============================

function createCharts() {
  const user =
    getCurrentLoggedUser();

  if (!user) {
    return;
  }

  ensureUserData(user);

  if (
    typeof Chart ===
    "undefined"
  ) {
    console.error(
      "Chart.js library not loaded"
    );

    return;
  }

  const mainChartCanvas =
    $("mainChart");

  const activityChartCanvas =
    $("activityChart");

  const weeklyChartCanvas =
    $("weeklyChart");

  if (mainChart) {
    mainChart.destroy();
    mainChart = null;
  }

  if (activityChartObj) {
    activityChartObj.destroy();
    activityChartObj = null;
  }

  if (weeklyChartObj) {
    weeklyChartObj.destroy();
    weeklyChartObj = null;
  }

  if (mainChartCanvas) {
    mainChart =
      new Chart(
        mainChartCanvas,
        {
          type: "pie",

          data: {
            labels: [
              "Active",
              "Idle"
            ],

            datasets: [
              {
                data: [
                  active,
                  idle
                ],

                backgroundColor: [
                  "#22c55e",
                  "#ef4444"
                ]
              }
            ]
          },

          options: {
            responsive: true,
            maintainAspectRatio:
              false
          }
        }
      );
  }

  if (activityChartCanvas) {
    activityChartObj =
      new Chart(
        activityChartCanvas,
        {
          type: "doughnut",

          data: {
            labels:
              Object.keys(
                user.activityData
              ),

            datasets: [
              {
                data:
                  Object.values(
                    user.activityData
                  ),

                backgroundColor: [
                  "#22c55e",
                  "#3b82f6",
                  "#f97316",
                  "#ef4444",
                  "#a855f7",
                  "#64748b"
                ]
              }
            ]
          },

          options: {
            responsive: true,
            maintainAspectRatio:
              false
          }
        }
      );
  }

  if (weeklyChartCanvas) {
    weeklyChartObj =
      new Chart(
        weeklyChartCanvas,
        {
          type: "bar",

          data: {
            labels: [
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat"
            ],

            datasets: [
              {
                label:
                  "Screen Time Seconds",

                data:
                  user.weeklyData,

                backgroundColor:
                  "#4f46e5"
              }
            ]
          },

          options: {
            responsive: true,
            maintainAspectRatio:
              false,

            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        }
      );
  }
}

// ===============================
// UPDATE CHARTS
// ===============================

function updateCharts() {
  const user =
    getCurrentLoggedUser();

  if (!user) {
    return;
  }

  ensureUserData(user);

  if (mainChart) {
    mainChart.data.datasets[0].data =
      [active, idle];

    mainChart.update();
  }

  if (activityChartObj) {
    activityChartObj.data.labels =
      Object.keys(
        user.activityData
      );

    activityChartObj
      .data
      .datasets[0]
      .data =
        Object.values(
          user.activityData
        );

    activityChartObj.update();
  }

  if (weeklyChartObj) {
    weeklyChartObj
      .data
      .datasets[0]
      .data =
        user.weeklyData;

    weeklyChartObj.update();
  }
}

// ===============================
// HISTORY TABLE
// ===============================

function loadHistoryTable() {
  const history =
    getHistory();

  const historyTable =
    $("historyTable");

  if (!historyTable) {
    return;
  }

  historyTable.innerHTML = "";

  if (
    history.length === 0
  ) {
    historyTable.innerHTML = `
      <tr>
        <td colspan="3">
          No idle history found
        </td>
      </tr>
    `;

    return;
  }

  history
    .slice()
    .reverse()
    .forEach(item => {
      historyTable.innerHTML += `
        <tr>

          <td>
            ${escapeHTML(
              item.user
            )}
          </td>

          <td>
            ${escapeHTML(
              item.idleTime
            )}
          </td>

          <td>
            ${escapeHTML(
              item.activeAgain
            )}
          </td>

        </tr>
      `;
    });
}

// ===============================
// FOCUS TIMER
// ===============================

function startFocus() {
  if (focusRunning) {
    alert(
      "Focus timer is already running"
    );

    return;
  }

  focusRunning = true;
  focusSeconds = 25 * 60;

  const focusTimer =
    $("focusTimer");

  if (focusTimer) {
    focusTimer.innerText =
      "Focus Timer: 25:00";
  }

  alert(
    "Focus Mode Started"
  );
}

setInterval(() => {
  if (!focusRunning) {
    return;
  }

  focusSeconds--;

  const minutes =
    Math.floor(
      focusSeconds / 60
    );

  const seconds =
    focusSeconds % 60;

  const focusTimer =
    $("focusTimer");

  if (focusTimer) {
    focusTimer.innerText =
      "Focus Timer: " +
      String(minutes)
        .padStart(2, "0") +
      ":" +
      String(seconds)
        .padStart(2, "0");
  }

  if (focusSeconds <= 0) {
    focusRunning = false;

    alert(
      "Focus completed! Take a 5-minute break."
    );

    notify(
      "Focus Completed",
      "Take a 5-minute break."
    );
  }
}, 1000);

// ===============================
// CLOCK
// ===============================

function updateClock() {
  const clock =
    $("clock");

  if (!clock) {
    return;
  }

  clock.innerText =
    "Current Time: " +
    new Date().toLocaleTimeString();
}

setInterval(
  updateClock,
  1000
);

// ===============================
// DARK MODE
// ===============================

function toggleDark() {
  document.body
    .classList
    .toggle("dark");

  const darkEnabled =
    document.body
      .classList
      .contains("dark");

  localStorage.setItem(
    "darkMode",
    darkEnabled
      ? "enabled"
      : "disabled"
  );
}

// ===============================
// SOUND
// ===============================

function playSound() {
  try {
    const audio =
      new Audio(
        "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
      );

    audio.play().catch(() => {});
  } catch (error) {
    console.error(
      "Sound error:",
      error
    );
  }
}

// ===============================
// NOTIFICATION
// ===============================

async function notify(
  title,
  message
) {
  if (
    !(
      "Notification" in window
    )
  ) {
    return;
  }

  try {
    if (
      Notification.permission ===
      "granted"
    ) {
      new Notification(
        title,
        {
          body: message
        }
      );

      return;
    }

    if (
      Notification.permission !==
      "denied"
    ) {
      const permission =
        await Notification
          .requestPermission();

      if (
        permission ===
        "granted"
      ) {
        new Notification(
          title,
          {
            body: message
          }
        );
      }
    }
  } catch (error) {
    console.error(
      "Notification error:",
      error
    );
  }
}

// ===============================
// FEATURE OUTPUT
// ===============================

function out(message) {
  const output =
    $("featureOutput");

  if (output) {
    output.innerHTML =
      message;
  }
}

// ===============================
// AI PRODUCTIVITY
// ===============================

function aiProductivity() {
  const user =
    getCurrentLoggedUser();

  if (!user) {
    out(
      "❌ User details not found."
    );

    return;
  }

  ensureUserData(user);

  const data =
    user.activityData;

  const study =
    Number(data.Study) || 0;

  const coding =
    Number(data.Coding) || 0;

  const youtube =
    Number(data.YouTube) || 0;

  const gaming =
    Number(data.Gaming) || 0;

  const socialMedia =
    Number(
      data["Social Media"]
    ) || 0;

  const other =
    Number(data.Other) || 0;

  const productiveTime =
    study + coding;

  const distractionTime =
    youtube +
    gaming +
    socialMedia +
    other;

  const totalActivity =
    productiveTime +
    distractionTime;

  const productivityScore =
    totalActivity > 0
      ? Math.round(
          (
            productiveTime /
            totalActivity
          ) * 100
        )
      : 0;

  let status;
  let advice;

  if (
    productivityScore >= 80
  ) {
    status =
      "Highly Productive";

    advice =
      "Excellent work. Maintain your current routine.";
  } else if (
    productivityScore >= 60
  ) {
    status =
      "Productive";

    advice =
      "Good performance. Reduce distractions slightly.";
  } else if (
    productivityScore >= 40
  ) {
    status =
      "Average";

    advice =
      "Increase Study and Coding time.";
  } else {
    status =
      "Low Productivity";

    advice =
      "Reduce Gaming, YouTube and Social Media time.";
  }

  out(`
    <h3>
      🤖 AI Productivity Result
    </h3>

    <p>
      <strong>User:</strong>
      ${escapeHTML(
        user.username
      )}
    </p>

    <p>
      <strong>Productive Time:</strong>
      ${productiveTime} sec
    </p>

    <p>
      <strong>Distraction Time:</strong>
      ${distractionTime} sec
    </p>

    <p>
      <strong>Score:</strong>
      ${productivityScore}%
    </p>

    <p>
      <strong>Status:</strong>
      ${status}
    </p>

    <p>
      <strong>Advice:</strong>
      ${advice}
    </p>
  `);
}

// ===============================
// OPEN / CLOSE CHATBOT
// ===============================

function openChatbot() {
  const chatBox =
    $("chatBox");

  if (!chatBox) {
    out(
      "❌ Chatbot HTML section not found."
    );

    return;
  }

  chatBox.classList
    .toggle("hidden");

  if (
    chatBox.classList
      .contains("hidden")
  ) {
    out(
      "🤖 AI Chatbot closed."
    );
  } else {
    out(
      "🤖 AI Chatbot opened."
    );

    const chatInput =
      $("chatInput");

    if (chatInput) {
      chatInput.focus();
    }
  }
}

// ===============================
// CHAT ENTER KEY
// ===============================

function handleChatEnter(
  event
) {
  if (
    event.key === "Enter"
  ) {
    event.preventDefault();

    chatReply();
  }
}

// ===============================
// CHATBOT REPLY
// ===============================

function chatReply() {
  const inputBox =
    $("chatInput");

  const outputBox =
    $("chatOutput");

  if (
    !inputBox ||
    !outputBox
  ) {
    alert(
      "Chatbot elements not found"
    );

    return;
  }

  const question =
    inputBox.value.trim();

  const input =
    question.toLowerCase();

  if (
    question === ""
  ) {
    outputBox.innerHTML =
      "🤖 Please enter a question.";

    inputBox.focus();

    return;
  }

  const user =
    getCurrentLoggedUser();

  let reply;

  if (
    input.includes("hello") ||
    input.includes("hi") ||
    input.includes("hey")
  ) {
    reply =
      "Hello! How can I help you?";
  } else if (
    input.includes(
      "total time"
    ) ||
    input.includes(
      "screen time"
    )
  ) {
    reply =
      "Your total screen time is " +
      (Number(
        user?.total
      ) || 0) +
      " seconds.";
  } else if (
    input.includes(
      "active time"
    )
  ) {
    reply =
      "Your active time is " +
      (Number(
        user?.active
      ) || 0) +
      " seconds.";
  } else if (
    input.includes(
      "idle time"
    )
  ) {
    reply =
      "Your idle time is " +
      (Number(
        user?.idle
      ) || 0) +
      " seconds.";
  } else if (
    input.includes(
      "productivity"
    ) ||
    input.includes("score")
  ) {
    const productivity =
      scoreCalc(
        user?.active || 0,
        user?.total || 0
      );

    reply =
      "Your productivity score is " +
      productivity +
      "%.";
  } else if (
    input.includes("idle")
  ) {
    reply =
      "The system detects inactivity, shows an idle alert and captures a dashboard screenshot.";
  } else if (
    input.includes("camera") ||
    input.includes("webcam")
  ) {
    reply =
      "Click Webcam Detection or Start Camera to enable the camera.";
  } else if (
    input.includes("report") ||
    input.includes("csv")
  ) {
    reply =
      "Admin can search a username and download that user's report.";
  } else if (
    input.includes("goal")
  ) {
    reply =
      "Enter your daily goal in minutes and click Save Goal.";
  } else if (
    input.includes("focus")
  ) {
    reply =
      "Click Start Focus to begin a 25-minute focus session.";
  } else if (
    input.includes("message") ||
    input.includes("inbox")
  ) {
    reply =
      "Admin messages and broadcasts will appear in the User Inbox.";
  } else if (
    input.includes("help")
  ) {
    reply =
      "Ask me about screen time, active time, idle time, productivity, reports, goals, camera, inbox or focus timer.";
  } else {
    reply =
      "I did not understand. Ask about screen time, idle time, productivity, reports, camera or goals.";
  }

  outputBox.innerHTML = `
    <p>
      <strong>You:</strong>
      ${escapeHTML(
        question
      )}
    </p>

    <p>
      <strong>🤖 Bot:</strong>
      ${reply}
    </p>
  `;

  inputBox.value = "";
  inputBox.focus();
}
// ===============================
// START WEBCAM
// ===============================

async function startWebcam() {
  const video =
    $("webcam");

  if (!video) {
    out(
      "❌ Webcam video element not found."
    );

    return;
  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices
      .getUserMedia
  ) {
    out(
      "❌ Camera API is not supported in this browser."
    );

    return;
  }

  try {
    if (webcamStream) {
      webcamStream
        .getTracks()
        .forEach(track =>
          track.stop()
        );
    }

    webcamStream =
      await navigator
        .mediaDevices
        .getUserMedia({
          video: {
            facingMode: "user"
          },
          audio: false
        });

    video.srcObject =
      webcamStream;

    video.style.display =
      "block";

    await video.play();

    out(
      "📷 Webcam started successfully."
    );
  } catch (error) {
    console.error(
      "Camera error:",
      error
    );

    out(`
      ❌ Camera could not start.<br>
      Please allow camera permission and use Live Server.
    `);
  }
}

// ===============================
// STOP WEBCAM
// ===============================

function stopWebcam() {
  const video =
    $("webcam");

  if (webcamStream) {
    webcamStream
      .getTracks()
      .forEach(track =>
        track.stop()
      );

    webcamStream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
    video.style.display =
      "none";
  }

  out(
    "❌ Webcam stopped."
  );
}

// ===============================
// FACE DETECTION DEMO
// ===============================

async function faceDetectionDemo() {
  await startWebcam();

  if (!webcamStream) {
    return;
  }

  out(`
    🙂 Face Detection Demo started.<br>
    Camera is active.<br>
    <strong>Status:</strong>
    Face area monitoring enabled.
  `);

  setTimeout(() => {
    if (webcamStream) {
      out(`
        🙂 Face detected in webcam area.<br>
        <strong>Confidence:</strong>
        Demo mode
      `);
    }
  }, 1500);
}

// ===============================
// EMOTION DETECTION DEMO
// ===============================

async function detectEmotion() {
  if (!webcamStream) {
    await startWebcam();
  }

  if (!webcamStream) {
    return;
  }

  const emotions = [
    {
      name: "Focused 😎",
      advice:
        "Continue your productive session."
    },
    {
      name: "Happy 😊",
      advice:
        "You appear comfortable."
    },
    {
      name: "Neutral 😐",
      advice:
        "Maintain a balanced posture."
    },
    {
      name: "Tired 😴",
      advice:
        "Take a short break and drink water."
    },
    {
      name: "Stressed 😟",
      advice:
        "Take a few deep breaths."
    }
  ];

  const selected =
    emotions[
      Math.floor(
        Math.random() *
        emotions.length
      )
    ];

  out(`
    🎭 Emotion Detection Demo<br>
    <strong>Detected:</strong>
    ${selected.name}<br>
    <strong>Suggestion:</strong>
    ${selected.advice}
  `);
}

// ===============================
// EYE REST REMINDER
// ===============================

function eyeRestReminder() {
  const message =
    "Look at an object 20 feet away for 20 seconds.";

  out(`
    👀 Eye Rest Reminder<br>
    ${message}
  `);

  alert(
    "👀 Eye Rest Reminder\n\n" +
    message
  );

  notify(
    "Eye Rest Reminder",
    message
  );
}

// ===============================
// BATTERY MONITOR
// ===============================

async function batteryMonitor() {
  if (!navigator.getBattery) {
    out(`
      🔋 Battery API is not supported by this browser.
    `);

    return;
  }

  try {
    const battery =
      await navigator
        .getBattery();

    const updateBatteryOutput =
      () => {
        const level =
          Math.round(
            battery.level *
            100
          );

        out(`
          <h3>
            🔋 Battery Monitor
          </h3>

          <p>
            <strong>
              Battery Level:
            </strong>
            ${level}%
          </p>

          <p>
            <strong>
              Charging:
            </strong>
            ${
              battery.charging
                ? "Yes"
                : "No"
            }
          </p>

          <p>
            <strong>
              Charging Time:
            </strong>
            ${
              Number.isFinite(
                battery.chargingTime
              )
                ? battery
                    .chargingTime +
                  " sec"
                : "Not available"
            }
          </p>

          <p>
            <strong>
              Discharging Time:
            </strong>
            ${
              Number.isFinite(
                battery.dischargingTime
              )
                ? battery
                    .dischargingTime +
                  " sec"
                : "Not available"
            }
          </p>
        `);
      };

    updateBatteryOutput();

    battery.addEventListener(
      "levelchange",
      updateBatteryOutput
    );

    battery.addEventListener(
      "chargingchange",
      updateBatteryOutput
    );
  } catch (error) {
    console.error(
      "Battery error:",
      error
    );

    out(
      "❌ Unable to read battery status."
    );
  }
}

// ===============================
// INTERNET SPEED / CONNECTION
// ===============================

async function internetSpeed() {
  out(
    "🌐 Checking internet connection..."
  );

  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  const startTime =
    performance.now();

  const testUrl =
    "https://www.google.com/favicon.ico?cache=" +
    Date.now();

  try {
    await fetch(
      testUrl,
      {
        cache: "no-store",
        mode: "no-cors"
      }
    );

    const endTime =
      performance.now();

    const durationSeconds =
      Math.max(
        (
          endTime -
          startTime
        ) / 1000,
        0.001
      );

    const approximateSizeBytes =
      15000;

    const speedMbps =
      (
        (
          approximateSizeBytes *
          8
        ) /
        durationSeconds /
        1000000
      ).toFixed(2);

    out(`
      <h3>
        🌐 Internet Connection
      </h3>

      <p>
        <strong>
          Approximate Speed:
        </strong>
        ${speedMbps} Mbps
      </p>

      <p>
        <strong>
          Connection Type:
        </strong>
        ${
          connection
            ?.effectiveType ||
          "Unknown"
        }
      </p>

      <p>
        <strong>
          Browser Estimated Downlink:
        </strong>
        ${
          connection
            ?.downlink ||
          "Unknown"
        } Mbps
      </p>

      <p>
        <strong>
          Round Trip Time:
        </strong>
        ${
          connection
            ?.rtt ||
          "Unknown"
        } ms
      </p>
    `);
  } catch (error) {
    console.error(
      "Internet check error:",
      error
    );

    out(`
      🌐 Internet status could not be measured.<br>
      Connection Type:
      ${
        connection
          ?.effectiveType ||
        "Unknown"
      }<br>
      Estimated Downlink:
      ${
        connection
          ?.downlink ||
        "Unknown"
      } Mbps
    `);
  }
}

// ===============================
// SESSION HISTORY OUTPUT
// ===============================

function showSessionHistory() {
  const history =
    getSessionHistory();

  if (
    history.length === 0
  ) {
    out(
      "📜 No session history found."
    );

    return;
  }

  const latestHistory =
    history
      .slice(-10)
      .reverse();

  out(`
    <h3>
      📜 Session History
    </h3>

    <ol>
      ${
        latestHistory
          .map(
            item =>
              `
                <li>
                  ${escapeHTML(
                    item
                  )}
                </li>
              `
          )
          .join("")
      }
    </ol>
  `);
}

// ===============================
// TIMELINE GRAPH
// ===============================

function timelineGraph() {
  const user =
    getCurrentLoggedUser();

  if (!user) {
    out(
      "❌ User data not found."
    );

    return;
  }

  ensureUserData(user);

  const weeklyData =
    user.weeklyData;

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  const maxValue =
    Math.max(
      ...weeklyData,
      1
    );

  const rows =
    weeklyData
      .map(
        (
          value,
          index
        ) => {
          const percentage =
            Math.round(
              (
                value /
                maxValue
              ) * 100
            );

          return `
            <div
              style="
                margin-bottom:
                12px;
              "
            >
              <strong>
                ${days[index]}
              </strong>

              —
              ${value} sec

              <div
                style="
                  width:100%;
                  background:#e5e7eb;
                  height:16px;
                  border-radius:10px;
                  overflow:hidden;
                  margin-top:5px;
                "
              >
                <div
                  style="
                    width:
                    ${percentage}%;
                    height:100%;
                    background:
                    #4f46e5;
                  "
                ></div>
              </div>
            </div>
          `;
        }
      )
      .join("");

  out(`
    <h3>
      📈 Weekly Timeline
    </h3>

    ${rows}
  `);
}

// ===============================
// LIVE USER MONITORING
// ===============================

function liveUserMonitoring() {
  const users =
    getUsers();

  const loggedUsername =
    localStorage.getItem(
      "currentUser"
    );

  const loggedRole =
    localStorage.getItem(
      "currentRole"
    );

  const loggedUser =
    users.find(
      user =>
        user.username ===
        loggedUsername
    );

  out(`
    <h3>
      👥 Live User Monitoring
    </h3>

    <p>
      <strong>
        Total Registered Users:
      </strong>
      ${users.length}
    </p>

    <p>
      <strong>
        Current Logged User:
      </strong>
      ${escapeHTML(
        loggedUsername ||
        "None"
      )}
    </p>

    <p>
      <strong>
        Role:
      </strong>
      ${escapeHTML(
        loggedRole ||
        "Unknown"
      )}
    </p>

    <p>
      <strong>
        Status:
      </strong>
      ${
        loggedUsername
          ? "🟢 Online"
          : "🔴 Offline"
      }
    </p>

    <p>
      <strong>
        Total Time:
      </strong>
      ${
        Number(
          loggedUser?.total
        ) || 0
      } sec
    </p>

    <p>
      <strong>
        Active Time:
      </strong>
      ${
        Number(
          loggedUser?.active
        ) || 0
      } sec
    </p>

    <p>
      <strong>
        Idle Time:
      </strong>
      ${
        Number(
          loggedUser?.idle
        ) || 0
      } sec
    </p>
  `);
}

// ===============================
// LIVE NOTIFICATION
// ===============================

async function sendLiveNotification() {
  if (
    !(
      "Notification" in window
    )
  ) {
    out(
      "🔔 Notifications are not supported."
    );

    return;
  }

  try {
    const permission =
      await Notification
        .requestPermission();

    if (
      permission ===
      "granted"
    ) {
      new Notification(
        "Screen Time Tracker",
        {
          body:
            "Admin sent a live notification."
        }
      );

      out(
        "🔔 Live notification sent."
      );
    } else {
      out(`
        ❌ Notification permission denied.<br>
        Allow notifications in browser settings.
      `);
    }
  } catch (error) {
    console.error(
      "Notification error:",
      error
    );

    out(
      "❌ Notification could not be sent."
    );
  }
}
// ===============================
// MANUAL DASHBOARD SCREENSHOT
// ===============================

async function screenshotDemo() {
  if (
    typeof html2canvas ===
    "undefined"
  ) {
    out(`
      ❌ html2canvas library not loaded.<br>
      Add html2canvas CDN in index.html.
    `);

    return;
  }

  const dashboard =
    $("dashboard");

  if (!dashboard) {
    out(
      "❌ Dashboard element not found."
    );

    return;
  }

  out(
    "📸 Capturing dashboard screenshot..."
  );

  try {
    const canvas =
      await html2canvas(
        dashboard,
        {
          backgroundColor:
            "#ffffff",

          scale: 1,

          useCORS: true,

          logging: false
        }
      );

    const imageData =
      canvas.toDataURL(
        "image/png"
      );

    const username =
      currentUser ||
      localStorage.getItem(
        "currentUser"
      ) ||
      "user";

    const link =
      document.createElement(
        "a"
      );

    link.href =
      imageData;

    link.download =
      username +
      "_dashboard_" +
      Date.now() +
      ".png";

    document.body
      .appendChild(link);

    link.click();

    link.remove();

    out(`
      📸 Screenshot captured and downloaded successfully.
    `);
  } catch (error) {
    console.error(
      "Screenshot error:",
      error
    );

    out(`
      ❌ Screenshot capture failed.<br>
      Run the project using VS Code Live Server.
    `);
  }
}

// ===============================
// SCREEN RECORDING
// ===============================

async function screenRecording() {
  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices
      .getDisplayMedia
  ) {
    out(
      "❌ Screen recording is not supported in this browser."
    );

    return;
  }

  if (
    screenRecorder &&
    screenRecorder.state ===
      "recording"
  ) {
    stopScreenRecording();

    return;
  }

  try {
    const displayStream =
      await navigator
        .mediaDevices
        .getDisplayMedia({
          video: true,
          audio: true
        });

    recordedScreenChunks = [];

    screenRecorder =
      new MediaRecorder(
        displayStream
      );

    screenRecorder.ondataavailable =
      event => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          recordedScreenChunks
            .push(event.data);
        }
      };

    screenRecorder.onstop =
      () => {
        const videoBlob =
          new Blob(
            recordedScreenChunks,
            {
              type: "video/webm"
            }
          );

        const videoUrl =
          URL.createObjectURL(
            videoBlob
          );

        const link =
          document.createElement(
            "a"
          );

        link.href =
          videoUrl;

        link.download =
          "screen_recording_" +
          Date.now() +
          ".webm";

        document.body
          .appendChild(link);

        link.click();

        link.remove();

        setTimeout(() => {
          URL.revokeObjectURL(
            videoUrl
          );
        }, 1000);

        out(`
          🎥 Screen recording stopped and downloaded successfully.
        `);
      };

    const videoTrack =
      displayStream
        .getVideoTracks()[0];

    if (videoTrack) {
      videoTrack.addEventListener(
        "ended",
        () => {
          if (
            screenRecorder &&
            screenRecorder.state ===
              "recording"
          ) {
            screenRecorder.stop();
          }
        }
      );
    }

    screenRecorder.start();

    out(`
      🎥 Screen recording started.<br>
      Click the Screen Recording button again to stop.
    `);
  } catch (error) {
    console.error(
      "Screen recording error:",
      error
    );

    out(`
      ❌ Screen sharing permission denied or recording cancelled.
    `);
  }
}

// ===============================
// STOP SCREEN RECORDING
// ===============================

function stopScreenRecording() {
  if (
    screenRecorder &&
    screenRecorder.state ===
      "recording"
  ) {
    screenRecorder.stop();
  }
}

// ===============================
// ADMIN BROADCAST PROMPT
// ===============================

function adminBroadcast() {
  const admin =
    getCurrentLoggedUser();

  if (
    !admin ||
    admin.role !== "Admin"
  ) {
    out(
      "❌ Only Admin can broadcast messages."
    );

    return;
  }

  const message =
    prompt(
      "Enter broadcast message:"
    );

  if (
    !message ||
    message.trim() === ""
  ) {
    out(
      "❌ Broadcast message cancelled."
    );

    return;
  }

  let sentCount = 0;

  let users = getUsers();

  users = users.map(user => {
    ensureUserData(user);

    if (user.role !== "Admin") {
      user.inbox.unshift({
        message:
          message.trim(),

        sender:
          currentUser,

        type:
          "broadcast",

        time:
          new Date()
            .toLocaleString()
      });

      sentCount++;
    }

    return user;
  });

  saveUsers(users);

  out(`
    📢 Broadcast sent successfully
    to ${sentCount} users.
  `);

  alert(
    "Broadcast sent to " +
    sentCount +
    " users"
  );
}

// ===============================
// TEST IDLE SCREENSHOT MANUALLY
// ===============================

async function testIdleScreenshot() {
  if (!currentUser) {
    alert(
      "Please login first"
    );

    return;
  }

  out(
    "📸 Testing idle screenshot..."
  );

  await captureIdleScreenshot();

  loadIdleScreenshots();

  out(`
    📸 Test completed.<br>
    Check the Idle Screenshot Reports section in Admin Panel.
  `);
}

// ===============================
// CHECK SAVED SCREENSHOT COUNT
// ===============================

function checkIdleScreenshotCount() {
  const screenshots =
    getIdleScreenshots();

  out(`
    📸 Total saved idle screenshots:
    <strong>
      ${screenshots.length}
    </strong>
  `);

  return screenshots.length;
}

// ===============================
// DELETE ALL USER MESSAGES
// ===============================

function clearMyInbox() {
  const confirmation =
    confirm(
      "Delete all inbox messages?"
    );

  if (!confirmation) {
    return;
  }

  let users = getUsers();

  users = users.map(user => {
    if (
      user.username ===
      currentUser
    ) {
      user.inbox = [];
    }

    return user;
  });

  saveUsers(users);

  loadInbox();

  alert(
    "Inbox cleared successfully"
  );
}

// ===============================
// CLEAR FEATURE OUTPUT
// ===============================

function clearFeatureOutput() {
  const output =
    $("featureOutput");

  if (output) {
    output.innerHTML =
      "Click any feature button...";
  }
}

// ===============================
// ONLINE / OFFLINE STATUS
// ===============================

function updateNetworkStatus() {
  if (!currentUser) {
    return;
  }

  if (navigator.onLine) {
    out(
      "🌐 Internet connection restored."
    );
  } else {
    out(
      "❌ Internet connection lost."
    );
  }
}

window.addEventListener(
  "online",
  updateNetworkStatus
);

window.addEventListener(
  "offline",
  updateNetworkStatus
);

// ===============================
// PAGE VISIBILITY TRACKING
// ===============================

document.addEventListener(
  "visibilitychange",
  () => {
    if (!currentUser) {
      return;
    }

    if (
      document.visibilityState ===
      "hidden"
    ) {
      recordSessionHistory(
        "Tab hidden: " +
        currentUser +
        " - " +
        new Date()
          .toLocaleString()
      );
    } else {
      lastActivity =
        Date.now();

      recordSessionHistory(
        "Tab visible: " +
        currentUser +
        " - " +
        new Date()
          .toLocaleString()
      );
    }
  }
);

// ===============================
// BEFORE PAGE CLOSE
// ===============================

window.addEventListener(
  "beforeunload",
  () => {
    if (currentUser) {
      saveCurrentUser();

      recordSessionHistory(
        "Page closed/refreshed: " +
        currentUser +
        " - " +
        new Date()
          .toLocaleString()
      );
    }
  }
);

// ===============================
// PREVENT DUPLICATE FORM SUBMIT
// ===============================

document.addEventListener(
  "submit",
  event => {
    event.preventDefault();
  }
);

// ===============================
// INITIAL APP LOAD
// ===============================

window.addEventListener(
  "DOMContentLoaded",
  () => {
    const savedDarkMode =
      localStorage.getItem(
        "darkMode"
      );

    if (
      savedDarkMode ===
      "enabled"
    ) {
      document.body
        .classList
        .add("dark");
    }

    const savedUser =
      localStorage.getItem(
        "currentUser"
      );

    const authBox =
      $("authBox");

    const dashboard =
      $("dashboard");

    if (savedUser) {
      const existingUser =
        getUsers().find(
          user =>
            user.username ===
            savedUser
        );

      if (existingUser) {
        currentUser =
          savedUser;

        lastActivity =
          Date.now();

        if (authBox) {
          authBox.classList
            .add("hidden");
        }

        if (dashboard) {
          dashboard.classList
            .remove("hidden");
        }

        loadUser();
      } else {
        localStorage.removeItem(
          "currentUser"
        );

        localStorage.removeItem(
          "currentRole"
        );

        if (authBox) {
          authBox.classList
            .remove("hidden");
        }

        if (dashboard) {
          dashboard.classList
            .add("hidden");
        }
      }
    } else {
      if (authBox) {
        authBox.classList
          .remove("hidden");
      }

      if (dashboard) {
        dashboard.classList
          .add("hidden");
      }

      showLogin();
    }

    updateClock();

    const sessionMessage =
      "App opened: " +
      new Date()
        .toLocaleString();

    recordSessionHistory(
      sessionMessage
    );
  }
);

// ===============================
// FINAL CONSOLE MESSAGE
// ===============================

console.log(
  "Screen Time Tracker Pro script loaded successfully"
);