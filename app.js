import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR-PUBLISHABLE-KEY";
const AUTH_REDIRECT_URL = new URL(".", window.location.href).href;

const configured =
  !SUPABASE_URL.includes("YOUR-PROJECT") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR-PUBLISHABLE-KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const pillars = [
  "Financial Sustainability",
  "Digital & Data Transformation",
  "Governance Stewardship",
  "Customer Experience Transformation",
  "Workforce & Leadership Transformation"
];

let currentUser = null;
let currentProfile = null;
let userProjects = [];
let adminProjects = [];
let adminProfiles = [];
let charts = {};

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  bindEvents();
  populatePillars();
  handleResetLink();

  if (!configured) {
    $("#configuration-warning").classList.remove("hidden");
    return;
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    await routeSession();
  });

  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user ?? null;
  await routeSession();
}

function bindEvents() {
  $("#login-form").addEventListener("submit", login);
  $("#forgot-password-button").addEventListener("click", () => toggleAuthCard("forgot"));
  $("#back-to-login-button").addEventListener("click", () => toggleAuthCard("login"));
  $("#forgot-password-form").addEventListener("submit", sendPasswordReset);

  $("#force-password-form").addEventListener("submit", completeForcedPasswordChange);
  $("#force-new-password").addEventListener("input", updatePasswordStrength);
  $("#force-logout-button").addEventListener("click", logout);

  $("#logout-button").addEventListener("click", logout);
  $("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#top-account-button").addEventListener("click", () => showModule("account"));

  $$(".nav-item").forEach(button =>
    button.addEventListener("click", () => showModule(button.dataset.module))
  );
  $$("[data-jump]").forEach(button =>
    button.addEventListener("click", () => showModule(button.dataset.jump))
  );
  $$("[data-open-initiative]").forEach(button =>
    button.addEventListener("click", () => openInitiativeModal())
  );

  $("#profile-form").addEventListener("submit", updateProfile);
  $("#change-password-form").addEventListener("submit", updatePasswordFromAccount);

  $("#user-search").addEventListener("input", renderUserInitiatives);
  $("#user-status-filter").addEventListener("change", renderUserInitiatives);
  $("#user-clear-filters").addEventListener("click", () => {
    $("#user-search").value = "";
    $("#user-status-filter").value = "";
    renderUserInitiatives();
  });

  $("#admin-search").addEventListener("input", renderAdminPortfolio);
  ["#admin-status-filter", "#admin-pillar-filter", "#admin-risk-filter"].forEach(selector =>
    $(selector).addEventListener("change", renderAdminPortfolio)
  );
  $("#admin-clear-filters").addEventListener("click", clearAdminFilters);

  $("#admin-create-user-form").addEventListener("submit", createUserAsAdmin);
  $("#generate-password-button").addEventListener("click", generateTemporaryPassword);
  $("#refresh-admin-data").addEventListener("click", loadAdminData);

  $("#initiative-form").addEventListener("submit", saveInitiative);
  $("#close-initiative-modal").addEventListener("click", closeInitiativeModal);
  $("#cancel-initiative-modal").addEventListener("click", closeInitiativeModal);
}

async function routeSession() {
  if (!currentUser) {
    showAuth();
    return;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error || !profile) {
    showToast(error?.message || "Unable to load your user profile.", true);
    await supabase.auth.signOut();
    return;
  }

  currentProfile = profile;

  if (profile.must_change_password) {
    showForcedPassword();
    return;
  }

  await openPlatform();
}

function showAuth() {
  $("#auth-screen").classList.remove("hidden");
  $("#force-password-screen").classList.add("hidden");
  $("#platform").classList.add("hidden");
}

function showForcedPassword() {
  $("#auth-screen").classList.add("hidden");
  $("#force-password-screen").classList.remove("hidden");
  $("#platform").classList.add("hidden");
}

async function openPlatform() {
  $("#auth-screen").classList.add("hidden");
  $("#force-password-screen").classList.add("hidden");
  $("#platform").classList.remove("hidden");

  renderIdentity();
  await loadUserProjects();

  if (currentProfile.role === "super_admin") {
    $("#admin-nav").classList.remove("hidden");
    $("#initiative-owner-field").classList.remove("hidden");
    await loadAdminData();
    showModule("admin-overview");
  } else {
    $("#admin-nav").classList.add("hidden");
    $("#initiative-owner-field").classList.add("hidden");
    showModule("user-home");
  }
}

function renderIdentity() {
  const name = currentProfile.full_name || currentUser.email;
  $("#sidebar-name").textContent = name;
  $("#sidebar-role").textContent = labelRole(currentProfile.role);
  $("#sidebar-avatar").textContent = initials(name);
  $("#welcome-title").textContent = `Welcome, ${name.split(" ")[0] || "User"}.`;
  $("#welcome-role").textContent = labelRole(currentProfile.role);
  $("#account-full-name").value = currentProfile.full_name || "";
  $("#account-email").value = currentUser.email || "";
  $("#account-department").value = currentProfile.department || "";
}

async function login(event) {
  event.preventDefault();
  if (!configured) return showToast("Configure Supabase in app.js first.", true);

  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Signing in...";

  const { error } = await supabase.auth.signInWithPassword({
    email: $("#login-email").value.trim(),
    password: $("#login-password").value
  });

  button.disabled = false;
  button.textContent = "Sign in";

  if (error) return showToast(error.message, true);
  $("#login-form").reset();
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  userProjects = [];
  adminProjects = [];
  adminProfiles = [];
  destroyCharts();
  showAuth();
}

function toggleAuthCard(target) {
  $("#login-form").classList.toggle("hidden", target !== "login");
  $("#forgot-password-form").classList.toggle("hidden", target !== "forgot");
}

async function sendPasswordReset(event) {
  event.preventDefault();
  const { error } = await supabase.auth.resetPasswordForEmail(
    $("#forgot-email").value.trim(),
    { redirectTo: AUTH_REDIRECT_URL }
  );
  if (error) return showToast(error.message, true);
  showToast("Password reset email sent.");
  toggleAuthCard("login");
}

function handleResetLink() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (hash.get("type") === "recovery") {
    window.setTimeout(() => showModule("account"), 700);
  }
}

async function completeForcedPasswordChange(event) {
  event.preventDefault();
  const password = $("#force-new-password").value;
  const confirm = $("#force-confirm-password").value;

  if (password !== confirm) return showToast("The passwords do not match.", true);
  if (!isStrongPassword(password)) {
    return showToast("Use at least 10 characters with uppercase, lowercase, number and symbol.", true);
  }

  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Updating...";

  const { error: authError } = await supabase.auth.updateUser({ password });
  if (authError) {
    button.disabled = false;
    button.textContent = "Change Password & Continue";
    return showToast(authError.message, true);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", currentUser.id);

  button.disabled = false;
  button.textContent = "Change Password & Continue";

  if (profileError) return showToast(profileError.message, true);

  currentProfile.must_change_password = false;
  currentProfile.password_changed_at = new Date().toISOString();
  $("#force-password-form").reset();
  showToast("Password changed successfully.");
  await openPlatform();
}

function updatePasswordStrength() {
  const password = $("#force-new-password").value;
  let score = 0;
  if (password.length >= 10) score += 25;
  if (/[A-Z]/.test(password)) score += 25;
  if (/[a-z]/.test(password) && /\d/.test(password)) score += 25;
  if (/[^A-Za-z0-9]/.test(password)) score += 25;
  $("#password-strength span").style.width = `${score}%`;
}

function isStrongPassword(password) {
  return password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

async function updateProfile(event) {
  event.preventDefault();
  const updates = {
    full_name: $("#account-full-name").value.trim(),
    department: $("#account-department").value.trim(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("profiles").update(updates).eq("id", currentUser.id);
  if (error) return showToast(error.message, true);

  Object.assign(currentProfile, updates);
  renderIdentity();
  showToast("Profile updated.");
}

async function updatePasswordFromAccount(event) {
  event.preventDefault();
  const password = $("#account-new-password").value;
  const confirm = $("#account-confirm-password").value;

  if (password !== confirm) return showToast("The passwords do not match.", true);
  if (!isStrongPassword(password)) {
    return showToast("Use at least 10 characters with uppercase, lowercase, number and symbol.", true);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return showToast(error.message, true);

  await supabase.from("profiles").update({
    password_changed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", currentUser.id);

  $("#change-password-form").reset();
  showToast("Password updated successfully.");
}

function showModule(name) {
  $$(".module").forEach(module => module.classList.remove("active"));
  $$(".nav-item").forEach(button => button.classList.remove("active"));

  const module = $(`#module-${name}`);
  const nav = $(`.nav-item[data-module="${name}"]`);
  if (!module) return;

  module.classList.add("active");
  nav?.classList.add("active");
  $("#page-title").textContent = nav?.querySelector("b")?.textContent || "HOME31";
  $("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "user-home") renderUserDashboard();
  if (name === "my-initiatives") renderUserInitiatives();
  if (name === "readiness") renderReadiness();
  if (name === "admin-overview") renderAdminOverview();
  if (name === "admin-portfolio") renderAdminPortfolio();
  if (name === "admin-users") renderAdminUsers();
  if (name === "admin-exceptions") renderAdminExceptions();
}

async function loadUserProjects() {
  const { data, error } = await supabase
    .from("initiatives")
    .select("*")
    .eq("created_by", currentUser.id)
    .order("updated_at", { ascending: false });

  if (error) return showToast(error.message, true);
  userProjects = data || [];
  renderUserDashboard();
  renderUserInitiatives();
  renderReadiness();
}

function renderUserDashboard() {
  const total = userProjects.length;
  const inProgress = userProjects.filter(project => project.status === "In Progress").length;
  const atRisk = userProjects.filter(project =>
    project.status === "At Risk" || ["High", "Extreme"].includes(project.risk_level)
  ).length;
  const average = total
    ? Math.round(userProjects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / total)
    : 0;

  $("#user-kpi-total").textContent = total;
  $("#user-kpi-progress").textContent = inProgress;
  $("#user-kpi-risk").textContent = atRisk;
  $("#user-kpi-average").textContent = `${average}%`;

  $("#user-recent-table tbody").innerHTML = userProjects.slice(0, 6).map(project => `
    <tr>
      <td><strong>${escapeHtml(project.initiative_name)}</strong></td>
      <td>${escapeHtml(project.strategic_pillar)}</td>
      <td><span class="status-pill">${escapeHtml(project.status)}</span></td>
      <td>${Number(project.readiness_score || 0)}%</td>
      <td>${progressBar(project.progress)}</td>
    </tr>
  `).join("");

  const gaps = userProjects.filter(project => Number(project.readiness_score || 0) < 70);
  $("#user-gap-list").innerHTML = gaps.length
    ? gaps.slice(0, 6).map(project => futureItem(project, `${project.readiness_score}% readiness`)).join("")
    : '<div class="notice blue">No initiatives below 70% readiness.</div>';

  renderUserStatusChart();
}

function renderUserStatusChart() {
  charts.userStatus?.destroy();
  if (typeof Chart === "undefined") return;

  const statuses = ["Planning", "In Progress", "At Risk", "On Hold", "Completed"];
  charts.userStatus = new Chart($("#user-status-chart"), {
    type: "doughnut",
    data: {
      labels: statuses,
      datasets: [{
        data: statuses.map(status => userProjects.filter(project => project.status === status).length)
      }]
    },
    options: baseChartOptions()
  });
}

function renderUserInitiatives() {
  const query = ($("#user-search").value || "").toLowerCase();
  const status = $("#user-status-filter").value || "";

  const filtered = userProjects.filter(project =>
    (!query || project.initiative_name.toLowerCase().includes(query)) &&
    (!status || project.status === status)
  );

  $("#user-initiative-list").innerHTML = filtered.length
    ? filtered.map(project => initiativeCard(project, false)).join("")
    : '<div class="notice blue">No matching initiatives.</div>';

  $$("[data-edit-project]").forEach(button =>
    button.addEventListener("click", () => openInitiativeModal(button.dataset.editProject))
  );
  $$("[data-delete-project]").forEach(button =>
    button.addEventListener("click", () => deleteInitiative(button.dataset.deleteProject))
  );
}

function renderReadiness() {
  const total = userProjects.length;
  const average = total
    ? Math.round(userProjects.reduce((sum, project) => sum + Number(project.readiness_score || 0), 0) / total)
    : 0;
  const low = userProjects.filter(project => Number(project.readiness_score || 0) < 70).length;
  const hr = userProjects.filter(project => ["Required", "To be confirmed"].includes(project.hr_collaboration_status)).length;
  const risk = userProjects.filter(project => ["High", "Extreme"].includes(project.risk_level)).length;

  $("#readiness-average").textContent = `${average}%`;
  $("#readiness-low").textContent = low;
  $("#readiness-hr").textContent = hr;
  $("#readiness-risk").textContent = risk;

  $("#readiness-list").innerHTML = userProjects.length
    ? userProjects.map(project => `
      <article class="readiness-card">
        <div class="initiative-card-head">
          <div>
            <strong>${escapeHtml(project.initiative_name)}</strong>
            <span>${escapeHtml(project.strategic_pillar)} · ${escapeHtml(project.risk_level)} risk</span>
          </div>
          <span class="status-pill">${Number(project.readiness_score || 0)}% ready</span>
        </div>
        <div class="progress-track"><span style="width:${Number(project.readiness_score || 0)}%"></span></div>
        <span>HR collaboration: ${escapeHtml(project.hr_collaboration_status || "Not required")}</span>
      </article>
    `).join("")
    : '<div class="notice blue">No initiatives available.</div>';
}

async function loadAdminData() {
  if (currentProfile?.role !== "super_admin") return;

  const [projectsResponse, profilesResponse] = await Promise.all([
    supabase.from("initiatives").select("*").order("updated_at", { ascending: false }),
    supabase.from("profiles").select("*").order("created_at", { ascending: false })
  ]);

  if (projectsResponse.error) return showToast(projectsResponse.error.message, true);
  if (profilesResponse.error) return showToast(profilesResponse.error.message, true);

  adminProjects = projectsResponse.data || [];
  adminProfiles = profilesResponse.data || [];
  populateOwnerOptions();
  renderAdminOverview();
  renderAdminPortfolio();
  renderAdminUsers();
  renderAdminExceptions();
}

function renderAdminOverview() {
  if (currentProfile?.role !== "super_admin") return;

  const today = new Date().toISOString().slice(0, 10);
  const total = adminProjects.length;
  const health = total
    ? Math.round(adminProjects.reduce((sum, project) => sum + Number(project.readiness_score || 0), 0) / total)
    : 0;
  const risk = adminProjects.filter(project =>
    project.status === "At Risk" || ["High", "Extreme"].includes(project.risk_level)
  ).length;
  const hr = adminProjects.filter(project => ["Required", "To be confirmed"].includes(project.hr_collaboration_status)).length;
  const overdue = adminProjects.filter(project =>
    project.target_date && project.target_date < today && project.status !== "Completed"
  ).length;

  $("#admin-kpi-total").textContent = total;
  $("#admin-kpi-health").textContent = `${health}%`;
  $("#admin-kpi-risk").textContent = risk;
  $("#admin-kpi-hr").textContent = hr;
  $("#admin-kpi-overdue").textContent = overdue;
  $("#admin-kpi-users").textContent = adminProfiles.length;

  renderAdminCharts();
}

function renderAdminCharts() {
  ["adminStatus", "adminPillar", "adminRisk", "adminDepartment"].forEach(key => charts[key]?.destroy());
  if (typeof Chart === "undefined") return;

  const statuses = ["Planning", "In Progress", "At Risk", "On Hold", "Completed"];
  const risks = ["Low", "Medium", "High", "Extreme"];

  charts.adminStatus = new Chart($("#admin-status-chart"), {
    type: "doughnut",
    data: {
      labels: statuses,
      datasets: [{ data: statuses.map(status => adminProjects.filter(project => project.status === status).length) }]
    },
    options: baseChartOptions()
  });

  charts.adminPillar = new Chart($("#admin-pillar-chart"), {
    type: "bar",
    data: {
      labels: pillars,
      datasets: [{ label: "Initiatives", data: pillars.map(pillar => adminProjects.filter(project => project.strategic_pillar === pillar).length), borderRadius: 8 }]
    },
    options: { ...baseChartOptions(), indexAxis: "y", scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  });

  charts.adminRisk = new Chart($("#admin-risk-chart"), {
    type: "pie",
    data: {
      labels: risks,
      datasets: [{ data: risks.map(risk => adminProjects.filter(project => project.risk_level === risk).length) }]
    },
    options: baseChartOptions()
  });

  const departments = [...new Set(adminProjects.map(project => project.department || "Not recorded"))];
  charts.adminDepartment = new Chart($("#admin-department-chart"), {
    type: "bar",
    data: {
      labels: departments,
      datasets: [{
        label: "Average readiness",
        data: departments.map(department => {
          const records = adminProjects.filter(project => (project.department || "Not recorded") === department);
          return records.length
            ? Math.round(records.reduce((sum, record) => sum + Number(record.readiness_score || 0), 0) / records.length)
            : 0;
        }),
        borderRadius: 8
      }]
    },
    options: { ...baseChartOptions(), scales: { y: { min: 0, max: 100 } } }
  });
}

function renderAdminPortfolio() {
  if (currentProfile?.role !== "super_admin") return;

  const query = ($("#admin-search").value || "").toLowerCase();
  const status = $("#admin-status-filter").value || "";
  const pillar = $("#admin-pillar-filter").value || "";
  const risk = $("#admin-risk-filter").value || "";

  const filtered = adminProjects.filter(project => {
    const profile = profileFor(project.created_by);
    const haystack = [
      project.initiative_name,
      project.accountable_owner,
      project.department,
      profile?.full_name,
      profile?.email
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query)) &&
      (!status || project.status === status) &&
      (!pillar || project.strategic_pillar === pillar) &&
      (!risk || project.risk_level === risk);
  });

  $("#admin-portfolio-table tbody").innerHTML = filtered.map(project => {
    const profile = profileFor(project.created_by);
    return `
      <tr>
        <td><strong>${escapeHtml(project.initiative_name)}</strong></td>
        <td>${escapeHtml(profile?.full_name || profile?.email || "Unknown")}</td>
        <td>${escapeHtml(project.department)}</td>
        <td>${escapeHtml(project.strategic_pillar)}</td>
        <td><span class="status-pill">${escapeHtml(project.status)}</span></td>
        <td><span class="risk-pill">${escapeHtml(project.risk_level)}</span></td>
        <td>${Number(project.readiness_score || 0)}%</td>
        <td>${progressBar(project.progress)}</td>
        <td><button class="text-button" data-admin-edit="${project.id}" type="button">Edit</button></td>
      </tr>
    `;
  }).join("");

  $$("[data-admin-edit]").forEach(button =>
    button.addEventListener("click", () => openInitiativeModal(button.dataset.adminEdit))
  );
}

function clearAdminFilters() {
  $("#admin-search").value = "";
  $("#admin-status-filter").value = "";
  $("#admin-pillar-filter").value = "";
  $("#admin-risk-filter").value = "";
  renderAdminPortfolio();
}

function renderAdminUsers() {
  if (currentProfile?.role !== "super_admin") return;

  $("#admin-user-list").innerHTML = adminProfiles.map(profile => `
    <article class="admin-user-card">
      <div>
        <strong>${escapeHtml(profile.full_name || profile.email)}</strong>
        <span>${escapeHtml(profile.email)} · ${escapeHtml(profile.department || "No department")}</span>
        <span>Password change required: ${profile.must_change_password ? "Yes" : "No"}</span>
      </div>
      <div>
        <span class="role-pill">${labelRole(profile.role)}</span>
        ${profile.id !== currentUser.id ? `
          <button class="text-button" data-toggle-role="${profile.id}" type="button">
            ${profile.role === "super_admin" ? "Make Normal User" : "Make Super Admin"}
          </button>
        ` : ""}
      </div>
    </article>
  `).join("");

  $$("[data-toggle-role]").forEach(button =>
    button.addEventListener("click", () => toggleRole(button.dataset.toggleRole))
  );
}

async function createUserAsAdmin(event) {
  event.preventDefault();
  if (currentProfile?.role !== "super_admin") return;

  const password = $("#admin-user-password").value;
  if (!isStrongPassword(password)) {
    return showToast("Temporary password must contain at least 10 characters with uppercase, lowercase, number and symbol.", true);
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return showToast("Your session has expired. Sign in again.", true);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": SUPABASE_PUBLISHABLE_KEY
    },
    body: JSON.stringify({
      full_name: $("#admin-user-name").value.trim(),
      department: $("#admin-user-department").value.trim(),
      email: $("#admin-user-email").value.trim().toLowerCase(),
      password
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return showToast(payload.error || `User creation failed with HTTP ${response.status}.`, true);

  $("#admin-create-user-form").reset();
  showToast("Active normal user created. The user must change the temporary password at first login.");
  await loadAdminData();
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const random = new Uint32Array(14);
  crypto.getRandomValues(random);
  $("#admin-user-password").value = Array.from(random, value => alphabet[value % alphabet.length]).join("");
}

async function toggleRole(profileId) {
  const profile = adminProfiles.find(item => item.id === profileId);
  if (!profile) return;

  const newRole = profile.role === "super_admin" ? "normal_user" : "super_admin";
  const { error } = await supabase.rpc("admin_set_user_role", {
    target_user_id: profileId,
    new_role: newRole
  });

  if (error) return showToast(error.message, true);
  showToast(`Role updated to ${labelRole(newRole)}.`);
  await loadAdminData();
}

function renderAdminExceptions() {
  if (currentProfile?.role !== "super_admin") return;

  const today = new Date().toISOString().slice(0, 10);
  const risk = adminProjects.filter(project => ["High", "Extreme"].includes(project.risk_level));
  const readiness = adminProjects.filter(project => Number(project.readiness_score || 0) < 70);
  const overdue = adminProjects.filter(project =>
    project.target_date && project.target_date < today && project.status !== "Completed"
  );

  $("#admin-exception-risk-count").textContent = risk.length;
  $("#admin-exception-readiness-count").textContent = readiness.length;
  $("#admin-exception-overdue-count").textContent = overdue.length;

  $("#admin-exception-risk-list").innerHTML = listOrEmpty(risk, project => `${project.risk_level} risk · ${project.status}`);
  $("#admin-exception-readiness-list").innerHTML = listOrEmpty(readiness, project => `${project.readiness_score}% readiness`);
  $("#admin-exception-overdue-list").innerHTML = listOrEmpty(overdue, project => `Target ${project.target_date}`);
}

function openInitiativeModal(projectId = null) {
  $("#initiative-form").reset();
  $("#initiative-id").value = "";
  $("#initiative-status").value = "Planning";
  $("#initiative-risk").value = "Medium";
  $("#initiative-progress").value = "0";
  $("#initiative-readiness").value = "50";
  $("#initiative-hr").value = "Not required";
  $("#initiative-created-by").value = currentUser.id;
  $("#initiative-modal-title").textContent = projectId ? "Edit Initiative" : "Create Initiative";

  const source = currentProfile?.role === "super_admin" ? adminProjects : userProjects;
  const project = source.find(item => String(item.id) === String(projectId));

  if (project) {
    $("#initiative-id").value = project.id;
    $("#initiative-created-by").value = project.created_by;
    $("#initiative-name").value = project.initiative_name || "";
    $("#initiative-department").value = project.department || "";
    $("#initiative-owner").value = project.accountable_owner || "";
    $("#initiative-pillar").value = project.strategic_pillar || pillars[0];
    $("#initiative-status").value = project.status || "Planning";
    $("#initiative-risk").value = project.risk_level || "Medium";
    $("#initiative-progress").value = project.progress || 0;
    $("#initiative-readiness").value = project.readiness_score || 0;
    $("#initiative-target-date").value = project.target_date || "";
    $("#initiative-hr").value = project.hr_collaboration_status || "Not required";
    $("#initiative-problem").value = project.problem_opportunity || "";
    $("#initiative-outcome").value = project.expected_outcome || "";
    $("#initiative-next-action").value = project.next_action || "";
  }

  $("#initiative-modal").classList.remove("hidden");
}

function closeInitiativeModal() {
  $("#initiative-modal").classList.add("hidden");
}

async function saveInitiative(event) {
  event.preventDefault();
  const id = $("#initiative-id").value;
  const createdBy =
    currentProfile?.role === "super_admin" && $("#initiative-created-by").value
      ? $("#initiative-created-by").value
      : currentUser.id;

  const record = {
    initiative_name: $("#initiative-name").value.trim(),
    department: $("#initiative-department").value.trim(),
    accountable_owner: $("#initiative-owner").value.trim(),
    strategic_pillar: $("#initiative-pillar").value,
    status: $("#initiative-status").value,
    risk_level: $("#initiative-risk").value,
    progress: Number($("#initiative-progress").value),
    readiness_score: Number($("#initiative-readiness").value),
    target_date: $("#initiative-target-date").value || null,
    hr_collaboration_status: $("#initiative-hr").value,
    problem_opportunity: $("#initiative-problem").value.trim(),
    expected_outcome: $("#initiative-outcome").value.trim(),
    next_action: $("#initiative-next-action").value.trim() || null,
    created_by: createdBy,
    updated_at: new Date().toISOString()
  };

  let response;
  if (id) {
    response = await supabase.from("initiatives").update(record).eq("id", id);
  } else {
    response = await supabase.from("initiatives").insert(record);
  }

  if (response.error) return showToast(response.error.message, true);

  closeInitiativeModal();
  showToast(id ? "Initiative updated." : "Initiative created.");

  await loadUserProjects();
  if (currentProfile.role === "super_admin") await loadAdminData();
}

async function deleteInitiative(projectId) {
  const project = userProjects.find(item => String(item.id) === String(projectId));
  if (!project) return;
  if (!window.confirm(`Delete "${project.initiative_name}"?`)) return;

  const { error } = await supabase.from("initiatives").delete().eq("id", projectId);
  if (error) return showToast(error.message, true);

  showToast("Initiative deleted.");
  await loadUserProjects();
}

function populatePillars() {
  ["#initiative-pillar", "#admin-pillar-filter"].forEach(selector => {
    const element = $(selector);
    if (!element) return;

    if (selector === "#admin-pillar-filter") {
      element.innerHTML = '<option value="">All pillars</option>';
    }

    element.insertAdjacentHTML(
      "beforeend",
      pillars.map(pillar => `<option>${escapeHtml(pillar)}</option>`).join("")
    );
  });
}

function populateOwnerOptions() {
  if (currentProfile?.role !== "super_admin") return;

  $("#initiative-created-by").innerHTML = adminProfiles.map(profile => `
    <option value="${profile.id}">
      ${escapeHtml(profile.full_name || profile.email)} — ${escapeHtml(profile.department || "No department")}
    </option>
  `).join("");
}

function profileFor(userId) {
  return adminProfiles.find(profile => profile.id === userId);
}

function initiativeCard(project) {
  return `
    <article class="initiative-card">
      <div class="initiative-card-head">
        <div>
          <strong>${escapeHtml(project.initiative_name)}</strong>
          <span>${escapeHtml(project.strategic_pillar)} · ${escapeHtml(project.department)}</span>
        </div>
        <span class="status-pill">${escapeHtml(project.status)}</span>
      </div>
      <span>Risk: ${escapeHtml(project.risk_level)} · Readiness: ${Number(project.readiness_score || 0)}% · HR: ${escapeHtml(project.hr_collaboration_status || "Not required")}</span>
      <div class="progress-track"><span style="width:${Number(project.progress || 0)}%"></span></div>
      <div class="initiative-actions">
        <button class="button secondary small" data-edit-project="${project.id}" type="button">Edit</button>
        <button class="text-button" data-delete-project="${project.id}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function futureItem(project, detail) {
  return `
    <article class="future-item">
      <strong>${escapeHtml(project.initiative_name)}</strong>
      <span>${escapeHtml(project.department || "No department")} · ${escapeHtml(detail)}</span>
    </article>
  `;
}

function listOrEmpty(items, detailBuilder) {
  return items.length
    ? items.map(project => futureItem(project, detailBuilder(project))).join("")
    : '<div class="notice blue">No records in this category.</div>';
}

function progressBar(value) {
  const progress = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div>${progress}%</div><div class="progress-track"><span style="width:${progress}%"></span></div>`;
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, usePointStyle: true }
      }
    }
  };
}

function destroyCharts() {
  Object.values(charts).forEach(chart => chart?.destroy());
  charts = {};
}

function showToast(message, error = false) {
  $("#toast").textContent = message;
  $("#toast").style.background = error ? "#8e1019" : "#1d1d20";
  $("#toast").classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => $("#toast").classList.add("hidden"), 4300);
}

function labelRole(role) {
  const labels = {
    super_admin: "Super Admin",
    normal_user: "Normal User",
    department_admin: "Department Admin",
    hr_admin: "HR Admin",
    finance_admin: "Finance Admin",
    auditor: "Auditor",
    viewer: "Viewer"
  };
  return labels[role] || role;
}

function initials(name) {
  return String(name || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
