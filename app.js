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

const COMPARISON_YEARS = [2026, 2027];
const DEFAULT_ADMIN_YEAR = "2027";

const EXECUTIVE_COLORS = {
  navy: "#102f49",
  grid: "rgba(141,178,200,.17)",
  text: "#b4c6d2",
  white: "#edf4f8",
  gold: "#d1ad63",
  teal: "#57999b",
  blue: "#7f99af",
  lightBlue: "#78a8c4",
  red: "#d26066",
  green: "#6ca69b",
  amber: "#d1ad63",
  slate: "#7892a6"
};

let pillarMetric = "count";
let selectedAdminYear = DEFAULT_ADMIN_YEAR;

const DISPLAY_SETTINGS_KEY = "home31-display-settings-v1";
const DISPLAY_MODES = ["standard", "comfortable", "large"];
let currentDisplaySize = "comfortable";
let highContrastEnabled = false;
let tableEnhancementScheduled = false;
let responsiveTableObserver = null;


let currentUser = null;
let currentProfile = null;
let userProjects = [];
let adminProjects = [];
let adminProfiles = [];
let charts = {};
let currentInitiativeFormStep = 1;

document.addEventListener("DOMContentLoaded", initialise);

async function initialise() {
  initialiseDisplaySettings();
  bindEvents();
  populatePillars();
  handleResetLink();
  initialiseResponsiveTables();

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
  $("#top-new-initiative").addEventListener("click", () => openInitiativeModal());
  $("#admin-year-select").addEventListener("change", handleAdminYearChange);

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
  $("#admin-overview-refresh").addEventListener("click", loadAdminData);
  $("#admin-portfolio-refresh").addEventListener("click", loadAdminData);
  $("#admin-export-portfolio").addEventListener("click", exportAdminPortfolioCsv);
  $("#admin-user-search").addEventListener("input", renderAdminUsers);
  $("#admin-user-role-filter").addEventListener("change", renderAdminUsers);
  $("#admin-user-password-filter").addEventListener("change", renderAdminUsers);
  $("#admin-clear-user-filters").addEventListener("click", clearAdminUserFilters);
  $$("[data-pillar-metric]").forEach(button =>
    button.addEventListener("click", () => {
      pillarMetric = button.dataset.pillarMetric;
      $$("[data-pillar-metric]").forEach(item => item.classList.toggle("active", item === button));
      renderExecutivePillarChart();
    })
  );

  $("#initiative-form").addEventListener("submit", saveInitiative);
  $("#close-initiative-modal").addEventListener("click", closeInitiativeModal);
  $("#cancel-initiative-modal").addEventListener("click", closeInitiativeModal);
  $("#initiative-next-step").addEventListener("click", nextInitiativeStep);
  $("#initiative-previous-step").addEventListener("click", previousInitiativeStep);
  $$(".initiative-step").forEach(button =>
    button.addEventListener("click", () => goToInitiativeStep(Number(button.dataset.formStep)))
  );
  $$("#initiative-form input, #initiative-form select, #initiative-form textarea").forEach(element => {
    element.addEventListener("input", () => {
      updateInitiativeFormMetrics();
      renderBudgetSummary();
    });
    element.addEventListener("change", () => {
      updateInitiativeFormMetrics();
      renderBudgetSummary();
    });
  });
  $$(".evidence-status").forEach(element =>
    element.addEventListener("change", updateEvidencePresentation)
  );
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
  document.body.classList.toggle("admin-command-active", name.startsWith("admin-"));
  const yearAwareModules = ["admin-overview", "admin-portfolio", "admin-exceptions"];
  $("#admin-year-control").classList.toggle("hidden", !yearAwareModules.includes(name));
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name === "user-home") renderUserDashboard();
  if (name === "my-initiatives") renderUserInitiatives();
  if (name === "readiness") renderReadiness();
  if (name === "admin-overview") renderAdminOverview();
  if (name === "admin-portfolio") renderAdminPortfolio();
  if (name === "admin-users") renderAdminUsers();
  if (name === "admin-exceptions") renderAdminExceptions();
  window.setTimeout(() => Object.values(charts).forEach(chart => chart?.resize?.()), 80);
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
        <span>HR collaboration: ${escapeHtml(project.hr_collaboration_status || "Not required")} · People impact: ${escapeHtml(project.people_impact_level || "Not assessed")}</span>
        <span>Training plan: ${escapeHtml(project.training_plan_status || "Not assessed")} · Change plan: ${escapeHtml(project.change_plan_status || "Not assessed")}</span>
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
  populateAdminYearOptions();
  populateOwnerOptions();
  renderAdminOverview();
  renderAdminPortfolio();
  renderAdminUsers();
  renderAdminExceptions();
}




function deriveHome31Fit(project) {
  if (!project.strategic_pillar || !project.project_description) return "Needs Validation";
  if (project.status === "On Hold") return "Duplicate / Consolidate";
  if (project.initiative_category === "Business as usual") return "BAU · Supporting Enhancement";
  if (["Strategic Priority", "Corporate Priority"].includes(project.priority_status) || project.priority === "Strategic") {
    return "Core Initiative";
  }
  if ((project.system_type && project.system_type !== "Non System") ||
      !["N/A", "None", null, undefined, ""].includes(project.ict_classification)) {
    return "Enabler";
  }
  if (project.strategic_thrust === "Good Governance" && project.priority_status === "Watchlist / Under Review") {
    return "Policy Review";
  }
  return "Supporting Activity";
}







function bindExecutiveRecordButtons() {
  $$("[data-executive-open]").forEach(button =>
    button.addEventListener("click", () => openInitiativeModal(button.dataset.executiveOpen))
  );
}



function executiveChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: true },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: EXECUTIVE_COLORS.text,
          usePointStyle: true,
          boxWidth: 9,
          padding: 15,
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: "#061b2b",
        titleColor: "#f0f5f8",
        bodyColor: "#b6c8d3",
        borderColor: "#476b84",
        borderWidth: 1,
        padding: 11
      }
    }
  };
}

function executiveCountScales() {
  return {
    x: {
      beginAtZero: true,
      grid: { color: EXECUTIVE_COLORS.grid },
      ticks: { color: EXECUTIVE_COLORS.text, precision: 0 }
    },
    y: {
      beginAtZero: true,
      grid: { color: EXECUTIVE_COLORS.grid },
      ticks: { color: EXECUTIVE_COLORS.text, precision: 0 }
    }
  };
}

function executiveMoneyScales() {
  return {
    x: {
      beginAtZero: true,
      grid: { color: EXECUTIVE_COLORS.grid },
      ticks: { color: EXECUTIVE_COLORS.text, callback: value => compactRinggit(value) }
    },
    y: {
      beginAtZero: true,
      grid: { color: EXECUTIVE_COLORS.grid },
      ticks: { color: EXECUTIVE_COLORS.text, callback: value => compactRinggit(value) }
    }
  };
}

function normalizePriorityGroup(project) {
  const value = project.priority_status;
  if (value === "Strategic Priority" || project.priority === "Strategic") return "Strategic Priority";
  if (value === "Watchlist / Under Review" || value === "Not Assessed") return "Watchlist / Under Review";
  if (value === "Recommended" || value === "Dept Monitoring") return "Recommended";
  return "Not Classified";
}

function effectiveProjectCost(project) {
  const challenged = project.estimated_cost_post_challenge;
  if (challenged !== null && challenged !== undefined && challenged !== "") {
    return Number(challenged) || 0;
  }
  return Number(project.estimated_cost || 0);
}


function shortPillar(value) {
  const names = {
    "Financial Sustainability": "Financial Sustainability",
    "Digital & Data Transformation": "Digital & Data",
    "Governance Stewardship": "Governance",
    "Customer Experience Transformation": "Customer Experience",
    "Workforce & Leadership Transformation": "Workforce & Leadership"
  };
  return names[value] || value;
}



function extractProjectDateRange(project) {
  const text = project.action_plan || "";
  const matches = [
    ...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g),
    ...text.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)
  ];

  const dates = matches.map(match => {
    if (match[1]?.length === 4) return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
    return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00`);
  }).filter(date => !Number.isNaN(date.getTime()));

  const fallback = [project.start_date, project.target_date]
    .filter(Boolean)
    .map(value => new Date(`${value}T00:00:00`))
    .filter(date => !Number.isNaN(date.getTime()));

  const all = [...dates, ...fallback].sort((a, b) => a - b);
  if (!all.length) return null;
  return { start: all[0], end: all[all.length - 1] };
}


function compactRinggit(value) {
  const number = Number(value || 0);
  const absolute = Math.abs(number);
  const sign = number < 0 ? "-" : "";
  if (absolute >= 1_000_000_000) return `${sign}RM${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}RM${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}RM${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}RM${absolute.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}


function aggregateFiltered(records, labelFn, valueFn) {
  const map = new Map();
  records.forEach(record => {
    const label = labelFn(record);
    map.set(label, (map.get(label) || 0) + Number(valueFn(record) || 0));
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
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

  const query = ($("#admin-user-search").value || "").toLowerCase();
  const role = $("#admin-user-role-filter").value || "";
  const passwordStatus = $("#admin-user-password-filter").value || "";

  const filtered = adminProfiles.filter(profile => {
    const haystack = [
      profile.full_name,
      profile.email,
      profile.department,
      labelRole(profile.role)
    ].join(" ").toLowerCase();

    const matchesPassword =
      !passwordStatus ||
      (passwordStatus === "pending" && profile.must_change_password) ||
      (passwordStatus === "complete" && !profile.must_change_password);

    return (!query || haystack.includes(query)) &&
      (!role || profile.role === role) &&
      matchesPassword;
  });

  const total = adminProfiles.length;
  const admins = adminProfiles.filter(profile => profile.role === "super_admin").length;
  const normal = adminProfiles.filter(profile => profile.role === "normal_user").length;
  const pending = adminProfiles.filter(profile => profile.must_change_password).length;
  const departments = new Set(adminProfiles.map(profile => profile.department).filter(Boolean)).size;
  const accessReadiness = total ? Math.round((total - pending) / total * 100) : 0;

  $("#users-kpi-total").textContent = total;
  $("#users-kpi-admins").textContent = admins;
  $("#users-kpi-normal").textContent = normal;
  $("#users-kpi-password").textContent = pending;
  $("#users-kpi-departments").textContent = departments;
  $("#users-kpi-readiness").textContent = `${accessReadiness}%`;
  $("#users-assurance-pending").textContent = pending;
  $("#admin-user-directory-count").textContent = `${filtered.length} user${filtered.length === 1 ? "" : "s"}`;

  $("#admin-user-list").innerHTML = filtered.length
    ? filtered.map(profile => `
      <article class="admin-command-user-card">
        <div>
          <strong>${escapeHtml(profile.full_name || profile.email)}</strong>
          <span>${escapeHtml(profile.email)}</span>
          <span>${escapeHtml(profile.department || "No department")} · Password change: ${profile.must_change_password ? "Required" : "Completed"}</span>
        </div>
        <div>
          <span class="role-pill">${labelRole(profile.role)}</span>
          ${profile.id !== currentUser.id ? `
            <button class="text-button" data-toggle-role="${profile.id}" type="button">
              ${profile.role === "super_admin" ? "Make Normal User" : "Make Super Admin"}
            </button>
          ` : '<span>Current account</span>'}
        </div>
      </article>
    `).join("")
    : '<div class="admin-command-empty">No users match the selected filters.</div>';

  $$("[data-toggle-role]").forEach(button =>
    button.addEventListener("click", () => toggleRole(button.dataset.toggleRole))
  );

  renderAdminUserGovernance();
}

function renderAdminUserGovernance() {
  charts.adminUserRole?.destroy();
  if (typeof Chart !== "undefined") {
    const roles = ["super_admin", "normal_user", "department_admin", "hr_admin", "finance_admin", "auditor", "viewer"];
    charts.adminUserRole = new Chart($("#admin-user-role-chart"), {
      type: "doughnut",
      data: {
        labels: roles.map(labelRole),
        datasets: [{
          data: roles.map(role => adminProfiles.filter(profile => profile.role === role).length),
          backgroundColor: ["#d1ad63", "#57999b", "#7f99af", "#6ca69b", "#7892a6", "#a76a6f", "#58768b"],
          borderColor: "#102f49",
          borderWidth: 4,
          cutout: "62%"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: EXECUTIVE_COLORS.text, usePointStyle: true, boxWidth: 8, font: { size: 12 } }
          }
        }
      }
    });
  }

  const pending = adminProfiles.filter(profile => profile.must_change_password).length;
  const adminCount = adminProfiles.filter(profile => profile.role === "super_admin").length;
  const noDepartment = adminProfiles.filter(profile => !profile.department).length;
  const duplicateEmails = adminProfiles.length - new Set(adminProfiles.map(profile => String(profile.email || "").toLowerCase())).size;

  $("#admin-user-governance-list").innerHTML = [
    ["Privileged accounts", `${adminCount} super-admin account${adminCount === 1 ? "" : "s"}`, adminCount],
    ["First-login follow-up", `${pending} user${pending === 1 ? "" : "s"} must change password`, pending],
    ["Department incomplete", `${noDepartment} profile${noDepartment === 1 ? "" : "s"} without department`, noDepartment],
    ["Duplicate email check", `${duplicateEmails} duplicate profile email${duplicateEmails === 1 ? "" : "s"}`, duplicateEmails]
  ].map(([title, detail, value]) => `
    <div class="admin-command-list-item">
      <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>
      <em>${value}</em>
    </div>
  `).join("");
}

function clearAdminUserFilters() {
  $("#admin-user-search").value = "";
  $("#admin-user-role-filter").value = "";
  $("#admin-user-password-filter").value = "";
  renderAdminUsers();
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


function renderExceptionList(records, detailBuilder) {
  return records.length
    ? records.slice(0, 8).map(project => `
      <div class="admin-command-list-item">
        <div>
          <strong>${escapeHtml(project.initiative_name)}</strong>
          <span>${escapeHtml(project.department || "No department")} · ${escapeHtml(detailBuilder(project))}</span>
        </div>
        <button data-exception-open="${project.id}" type="button">Open</button>
      </div>
    `).join("")
    : '<div class="admin-command-empty">No records in this category.</div>';
}


function openInitiativeModal(projectId = null) {
  $("#initiative-form").reset();
  $("#initiative-id").value = "";
  $("#initiative-year").value = selectedAdminYear === "all" ? "2027" : String(selectedAdminYear);
  $("#initiative-category").value = "New Initiative";
  $("#initiative-priority").value = "High";
  $("#initiative-priority-status").value = "Not Assessed";
  $("#initiative-status").value = "Planning";
  $("#initiative-risk").value = "Medium";
  $("#initiative-system-type").value = "Non System";
  $("#initiative-ict-classification").value = "N/A";
  $("#initiative-progress").value = "0";
  $("#initiative-readiness").value = "50";
  $("#initiative-estimated-cost").value = "0";
  $("#initiative-estimated-cost-post-challenge").value = "0";
  $("#initiative-hr").value = "Not required";
  $("#initiative-people-impact").value = "Medium";
  $("#initiative-training-required").value = "To be assessed";
  $("#initiative-training-plan-status").value = "Not started";
  $("#initiative-change-required").value = "Yes";
  $("#initiative-change-plan-status").value = "Not started";
  $("#initiative-communication-plan-status").value = "Not started";
  $("#initiative-hr-review-status").value = "Not submitted";
  $("#initiative-created-by").value = currentUser.id;
  $("#initiative-modal-title").textContent = projectId ? "Edit Initiative" : "Create Initiative";

  const source = currentProfile?.role === "super_admin" ? adminProjects : userProjects;
  const project = source.find(item => String(item.id) === String(projectId));

  if (project) {
    $("#initiative-id").value = project.id;
    $("#initiative-created-by").value = project.created_by;
    $("#initiative-source-reference").value = project.source_reference_no || "";
    $("#initiative-year").value = project.implementation_year || 2027;
    $("#initiative-name").value = project.initiative_name || "";
    $("#initiative-project-description").value = project.project_description || "";
    $("#initiative-department").value = project.department || "";
    $("#initiative-category").value = project.initiative_category || "New Initiative";
    $("#initiative-priority").value = project.priority || "High";
    $("#initiative-priority-status").value = project.priority_status || "Not Assessed";
    $("#initiative-executive-sponsor").value = project.executive_sponsor || "";
    $("#initiative-owner").value = project.accountable_owner || "";
    $("#initiative-delivery-lead").value = project.delivery_lead || "";
    $("#initiative-start-date").value = project.start_date || "";
    $("#initiative-target-date").value = project.target_date || "";
    $("#initiative-status").value = project.status || "Planning";
    $("#initiative-risk").value = project.risk_level || "Medium";

    $("#initiative-pillar").value = project.strategic_pillar || pillars[0];
    $("#initiative-strategic-thrust").value = project.strategic_thrust || "Operational Excellence";
    $("#initiative-strategic-priority-area").value = project.strategic_priority_area || "Improving Productivity, Efficiency and Delivery of Service (PEDS)";
    $("#initiative-system-type").value = project.system_type || "Non System";
    $("#initiative-ict-classification").value = project.ict_classification || "N/A";
    $("#initiative-ict-remarks").value = project.ict_remarks || "";

    $("#initiative-problem").value = project.problem_opportunity || "";
    $("#initiative-outcome").value = project.expected_outcome || "";
    $("#initiative-value-measure").value = project.value_measure || "";
    $("#initiative-value-baseline").value = project.value_baseline || "";
    $("#initiative-value-target").value = project.value_target || "";
    $("#initiative-value-frequency").value = project.value_frequency || "Quarterly";
    $("#initiative-value-owner").value = project.value_owner || "";
    $("#initiative-cba-ratio").value = project.cba_ratio ?? "";
    $("#initiative-progress").value = project.progress || 0;
    $("#initiative-readiness").value = project.readiness_score || 0;
    $("#initiative-action-plan").value = project.action_plan || "";
    $("#initiative-next-action").value = project.next_action || "";

    $("#initiative-estimated-cost").value = project.estimated_cost ?? 0;
    $("#initiative-estimated-cost-post-challenge").value = project.estimated_cost_post_challenge ?? 0;
    $("#initiative-proposed-budget").value = project.proposed_budget_post_retreat ?? "";
    $("#initiative-approved-budget").value = project.approved_budget ?? "";
    $("#initiative-post-challenge-remarks").value = project.post_challenge_remarks || "";
    $("#initiative-finance-remarks").value = project.finance_remarks || "";
    $("#initiative-general-remarks").value = project.general_remarks || "";

    $("#initiative-hr").value = project.hr_collaboration_status || "Not required";
    $("#initiative-people-impact").value = project.people_impact_level || "Medium";
    $("#initiative-affected-groups").value = project.affected_workforce_groups || "";
    $("#initiative-roles-affected").value = project.roles_affected_count || 0;
    $("#initiative-hr-owner").value = project.hr_owner || "";
    $("#initiative-new-roles-required").checked = Boolean(project.new_roles_required);
    $("#initiative-redeployment-required").checked = Boolean(project.redeployment_required);
    $("#initiative-org-design-impact").value = project.organisation_design_impact || "";
    $("#initiative-capability-gap").value = project.capability_gap || "";
    $("#initiative-training-required").value = project.training_required || "To be assessed";
    $("#initiative-training-plan-status").value = project.training_plan_status || "Not started";
    $("#initiative-change-required").value = project.change_management_required || "Yes";
    $("#initiative-change-plan-status").value = project.change_plan_status || "Not started";
    $("#initiative-communication-plan-status").value = project.communication_plan_status || "Not started";
    $("#initiative-hr-review-status").value = project.hr_review_status || "Not submitted";
    $("#initiative-hr-comments").value = project.hr_comments || "";

    $("#evidence-problem").value = project.evidence_problem_status || "Not available";
    $("#evidence-baseline").value = project.evidence_baseline_status || "Not available";
    $("#evidence-business-case").value = project.evidence_business_case_status || "Not available";
    $("#evidence-financial").value = project.evidence_financial_status || "Not available";
    $("#evidence-risk").value = project.evidence_risk_status || "Not available";
    $("#evidence-implementation").value = project.evidence_implementation_status || "Not available";
    $("#evidence-hr").value = project.evidence_hr_status || "Not available";
    $("#evidence-ict").value = project.evidence_ict_status || "Not available";
    $("#evidence-stakeholder").value = project.evidence_stakeholder_status || "Not available";
    $("#evidence-challenge").value = project.evidence_challenge_status || "Not available";
    $("#initiative-evidence-reference").value = project.evidence_reference || "";
    $("#initiative-evidence-notes").value = project.evidence_notes || "";
  }

  currentInitiativeFormStep = 1;
  renderInitiativeFormStep();
  updateEvidencePresentation();
  renderBudgetSummary();
  updateInitiativeFormMetrics();
  $("#initiative-modal").classList.remove("hidden");
}

function closeInitiativeModal() {
  $("#initiative-modal").classList.add("hidden");
}

function goToInitiativeStep(step) {
  if (step > currentInitiativeFormStep && !validateInitiativeStep(currentInitiativeFormStep)) return;
  currentInitiativeFormStep = Math.max(1, Math.min(7, step));
  renderInitiativeFormStep();
}

function nextInitiativeStep() {
  if (!validateInitiativeStep(currentInitiativeFormStep)) return;
  currentInitiativeFormStep = Math.min(7, currentInitiativeFormStep + 1);
  renderInitiativeFormStep();
}

function previousInitiativeStep() {
  currentInitiativeFormStep = Math.max(1, currentInitiativeFormStep - 1);
  renderInitiativeFormStep();
}

function renderInitiativeFormStep() {
  $$(".initiative-form-step").forEach(panel =>
    panel.classList.toggle("active", Number(panel.dataset.stepPanel) === currentInitiativeFormStep)
  );

  $$(".initiative-step").forEach(button => {
    const step = Number(button.dataset.formStep);
    button.classList.toggle("active", step === currentInitiativeFormStep);
    button.classList.toggle("completed", step < currentInitiativeFormStep);
  });

  $("#initiative-previous-step").classList.toggle("hidden", currentInitiativeFormStep === 1);
  $("#initiative-next-step").classList.toggle("hidden", currentInitiativeFormStep === 7);
  $("#save-initiative-button").classList.toggle("hidden", currentInitiativeFormStep !== 7);

  if (currentInitiativeFormStep === 4) renderBudgetSummary();
  if (currentInitiativeFormStep === 7) renderInitiativeReviewSummary();
}

function validateInitiativeStep(step) {
  const panel = $(`.initiative-form-step[data-step-panel="${step}"]`);
  const required = [...panel.querySelectorAll("[required]")];

  for (const field of required) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }

  if (step === 1) {
    const start = $("#initiative-start-date").value;
    const target = $("#initiative-target-date").value;
    if (start && target && target < start) {
      showToast("Target completion date cannot be earlier than the start date.", true);
      return false;
    }
  }

  return true;
}

function calculateEvidenceScore() {
  const statuses = $$(".evidence-status").map(element => element.value);
  const applicable = statuses.filter(status => status !== "Not applicable");
  if (!applicable.length) return 100;

  const score = applicable.reduce((sum, status) => {
    if (status === "Available") return sum + 1;
    if (status === "In progress") return sum + 0.5;
    return sum;
  }, 0);

  return Math.round(score / applicable.length * 100);
}

function updateEvidencePresentation() {
  $$(".evidence-status").forEach(select => {
    const item = select.closest(".evidence-item");
    item.classList.remove("available", "in-progress", "not-available");
    if (select.value === "Available") item.classList.add("available");
    if (select.value === "In progress") item.classList.add("in-progress");
    if (select.value === "Not available") item.classList.add("not-available");
  });

  const score = calculateEvidenceScore();
  $("#initiative-evidence-score").textContent = `${score}%`;
  $("#initiative-evidence-bar").style.width = `${score}%`;
  updateInitiativeFormMetrics();
}

function updateInitiativeFormMetrics() {
  const fields = [
    "#initiative-year",
    "#initiative-name",
    "#initiative-project-description",
    "#initiative-department",
    "#initiative-category",
    "#initiative-priority-status",
    "#initiative-executive-sponsor",
    "#initiative-owner",
    "#initiative-delivery-lead",
    "#initiative-pillar",
    "#initiative-strategic-thrust",
    "#initiative-strategic-priority-area",
    "#initiative-system-type",
    "#initiative-ict-classification",
    "#initiative-problem",
    "#initiative-outcome",
    "#initiative-value-measure",
    "#initiative-value-target",
    "#initiative-action-plan",
    "#initiative-hr",
    "#evidence-problem",
    "#evidence-baseline"
  ];

  const complete = fields.filter(selector => {
    const element = $(selector);
    return element && String(element.value || "").trim() !== "";
  }).length;

  const score = Math.round(complete / fields.length * 100);
  $("#initiative-form-completion").textContent = `${score}%`;
  $("#initiative-form-completion-bar").style.width = `${score}%`;

  if (currentInitiativeFormStep === 7) renderInitiativeReviewSummary();
}

function numberValue(selector) {
  const raw = $(selector).value;
  return raw === "" ? null : Number(raw);
}

function formatRinggit(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Not recorded";
  return `RM ${Number(value).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderBudgetSummary() {
  const initial = numberValue("#initiative-estimated-cost") || 0;
  const challenged = numberValue("#initiative-estimated-cost-post-challenge") || 0;
  const proposed = numberValue("#initiative-proposed-budget");
  const approved = numberValue("#initiative-approved-budget");
  const challengeVariance = challenged - initial;
  const approvalVariance = approved === null ? null : approved - challenged;

  $("#initiative-budget-summary").innerHTML = `
    <article><span>Initial estimate</span><strong>${formatRinggit(initial)}</strong></article>
    <article><span>Post-challenge variance</span><strong>${formatRinggit(challengeVariance)}</strong></article>
    <article><span>Proposed budget</span><strong>${formatRinggit(proposed)}</strong></article>
    <article><span>Approved vs challenge</span><strong>${formatRinggit(approvalVariance)}</strong></article>
  `;
}

function renderInitiativeReviewSummary() {
  const evidenceScore = calculateEvidenceScore();
  const evidenceGaps = $$(".evidence-status")
    .filter(element => element.value === "Not available")
    .map(element => element.closest(".evidence-item").querySelector("span").textContent.trim());

  const approved = numberValue("#initiative-approved-budget");
  const challenged = numberValue("#initiative-estimated-cost-post-challenge");

  $("#initiative-review-summary").innerHTML = `
    <article class="review-card">
      <span>Initiative / category</span>
      <strong>${escapeHtml($("#initiative-name").value || "Not completed")} · ${escapeHtml($("#initiative-category").value)}</strong>
    </article>
    <article class="review-card">
      <span>Department / year / priority</span>
      <strong>${escapeHtml($("#initiative-department").value || "Not completed")} · ${escapeHtml($("#initiative-year").value)} · ${escapeHtml($("#initiative-priority-status").value)}</strong>
    </article>
    <article class="review-card">
      <span>Executive sponsor</span>
      <strong>${escapeHtml($("#initiative-executive-sponsor").value || "Not completed")}</strong>
    </article>
    <article class="review-card">
      <span>Accountable owner / Delivery lead</span>
      <strong>${escapeHtml($("#initiative-owner").value || "Not completed")} / ${escapeHtml($("#initiative-delivery-lead").value || "Not completed")}</strong>
    </article>
    <article class="review-card">
      <span>HOME31 / strategic thrust</span>
      <strong>${escapeHtml($("#initiative-pillar").value)} · ${escapeHtml($("#initiative-strategic-thrust").value)}</strong>
    </article>
    <article class="review-card">
      <span>System / ICT classification</span>
      <strong>${escapeHtml($("#initiative-system-type").value)} · ${escapeHtml($("#initiative-ict-classification").value)}</strong>
    </article>
    <article class="review-card">
      <span>Value measure and target</span>
      <strong>${escapeHtml($("#initiative-value-measure").value || "Not completed")} → ${escapeHtml($("#initiative-value-target").value || "Not completed")}</strong>
    </article>
    <article class="review-card">
      <span>CBA / approved budget</span>
      <strong>${escapeHtml($("#initiative-cba-ratio").value || "Not recorded")} · ${formatRinggit(approved)}</strong>
    </article>
    <article class="review-card">
      <span>HR and people impact</span>
      <strong>${escapeHtml($("#initiative-hr").value)} · ${escapeHtml($("#initiative-people-impact").value)} impact · ${escapeHtml($("#initiative-hr-review-status").value)}</strong>
    </article>
    <article class="review-card ${evidenceScore >= 70 ? "good" : "warning"}">
      <span>Evidence completeness</span>
      <strong>${evidenceScore}%</strong>
    </article>
    <article class="review-card full">
      <span>Challenge-session decision</span>
      <strong>${escapeHtml($("#initiative-post-challenge-remarks").value || "No remarks recorded")}</strong>
    </article>
    <article class="review-card full">
      <span>Outstanding evidence gaps</span>
      ${
        evidenceGaps.length
          ? `<ul>${evidenceGaps.map(gap => `<li>${escapeHtml(gap)}</li>`).join("")}</ul>`
          : "<strong>No evidence item is marked unavailable.</strong>"
      }
    </article>
  `;
}

async function saveInitiative(event) {
  event.preventDefault();

  for (let step = 1; step <= 7; step += 1) {
    if (!validateInitiativeStep(step)) {
      currentInitiativeFormStep = step;
      renderInitiativeFormStep();
      return;
    }
  }

  const id = $("#initiative-id").value;
  const createdBy =
    currentProfile?.role === "super_admin" && $("#initiative-created-by").value
      ? $("#initiative-created-by").value
      : currentUser.id;

  const record = {
    source_reference_no: $("#initiative-source-reference").value.trim() || null,
    implementation_year: Number($("#initiative-year").value),
    initiative_name: $("#initiative-name").value.trim(),
    project_description: $("#initiative-project-description").value.trim(),
    department: $("#initiative-department").value.trim(),
    initiative_category: $("#initiative-category").value,
    priority: $("#initiative-priority").value,
    priority_status: $("#initiative-priority-status").value,
    executive_sponsor: $("#initiative-executive-sponsor").value.trim(),
    accountable_owner: $("#initiative-owner").value.trim(),
    delivery_lead: $("#initiative-delivery-lead").value.trim(),
    start_date: $("#initiative-start-date").value || null,
    target_date: $("#initiative-target-date").value || null,
    status: $("#initiative-status").value,
    risk_level: $("#initiative-risk").value,

    strategic_pillar: $("#initiative-pillar").value,
    strategic_thrust: $("#initiative-strategic-thrust").value,
    strategic_priority_area: $("#initiative-strategic-priority-area").value,
    system_type: $("#initiative-system-type").value,
    ict_classification: $("#initiative-ict-classification").value,
    ict_remarks: $("#initiative-ict-remarks").value.trim() || null,

    problem_opportunity: $("#initiative-problem").value.trim(),
    expected_outcome: $("#initiative-outcome").value.trim(),
    value_measure: $("#initiative-value-measure").value.trim(),
    value_baseline: $("#initiative-value-baseline").value.trim() || null,
    value_target: $("#initiative-value-target").value.trim(),
    value_frequency: $("#initiative-value-frequency").value,
    value_owner: $("#initiative-value-owner").value.trim() || null,
    cba_ratio: numberValue("#initiative-cba-ratio"),
    progress: Number($("#initiative-progress").value),
    readiness_score: Number($("#initiative-readiness").value),
    action_plan: $("#initiative-action-plan").value.trim(),
    next_action: $("#initiative-next-action").value.trim() || null,

    estimated_cost: numberValue("#initiative-estimated-cost") || 0,
    estimated_cost_post_challenge: numberValue("#initiative-estimated-cost-post-challenge") || 0,
    proposed_budget_post_retreat: numberValue("#initiative-proposed-budget"),
    approved_budget: numberValue("#initiative-approved-budget"),
    post_challenge_remarks: $("#initiative-post-challenge-remarks").value.trim() || null,
    finance_remarks: $("#initiative-finance-remarks").value.trim() || null,
    general_remarks: $("#initiative-general-remarks").value.trim() || null,

    hr_collaboration_status: $("#initiative-hr").value,
    people_impact_level: $("#initiative-people-impact").value,
    affected_workforce_groups: $("#initiative-affected-groups").value.trim() || null,
    roles_affected_count: Number($("#initiative-roles-affected").value || 0),
    hr_owner: $("#initiative-hr-owner").value.trim() || null,
    new_roles_required: $("#initiative-new-roles-required").checked,
    redeployment_required: $("#initiative-redeployment-required").checked,
    organisation_design_impact: $("#initiative-org-design-impact").value.trim() || null,
    capability_gap: $("#initiative-capability-gap").value.trim() || null,
    training_required: $("#initiative-training-required").value,
    training_plan_status: $("#initiative-training-plan-status").value,
    change_management_required: $("#initiative-change-required").value,
    change_plan_status: $("#initiative-change-plan-status").value,
    communication_plan_status: $("#initiative-communication-plan-status").value,
    hr_review_status: $("#initiative-hr-review-status").value,
    hr_comments: $("#initiative-hr-comments").value.trim() || null,

    evidence_problem_status: $("#evidence-problem").value,
    evidence_baseline_status: $("#evidence-baseline").value,
    evidence_business_case_status: $("#evidence-business-case").value,
    evidence_financial_status: $("#evidence-financial").value,
    evidence_risk_status: $("#evidence-risk").value,
    evidence_implementation_status: $("#evidence-implementation").value,
    evidence_hr_status: $("#evidence-hr").value,
    evidence_ict_status: $("#evidence-ict").value,
    evidence_stakeholder_status: $("#evidence-stakeholder").value,
    evidence_challenge_status: $("#evidence-challenge").value,
    evidence_reference: $("#initiative-evidence-reference").value.trim() || null,
    evidence_notes: $("#initiative-evidence-notes").value.trim() || null,
    evidence_completeness: calculateEvidenceScore(),

    created_by: createdBy,
    updated_at: new Date().toISOString()
  };

  const response = id
    ? await supabase.from("initiatives").update(record).eq("id", id)
    : await supabase.from("initiatives").insert(record);

  if (response.error) return showToast(response.error.message, true);

  closeInitiativeModal();
  showToast(id ? "Excel-aligned comprehensive initiative updated." : "Excel-aligned comprehensive initiative created.");

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
      <span>${escapeHtml(project.initiative_category || "Unclassified")} · ${escapeHtml(project.system_type || "System not recorded")} · ${escapeHtml(project.priority_status || "Not assessed")}</span>
      <span>Sponsor: ${escapeHtml(project.executive_sponsor || "Not recorded")} · Delivery lead: ${escapeHtml(project.delivery_lead || "Not recorded")}</span>
      <span>Risk: ${escapeHtml(project.risk_level)} · Readiness: ${Number(project.readiness_score || 0)}% · HR: ${escapeHtml(project.hr_collaboration_status || "Not required")} · Evidence: ${Number(project.evidence_completeness || 0)}%</span>
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


/* ================================================================
   V7.5 YEAR-AWARE LIVE PORTFOLIO OVERRIDES
   ================================================================ */
function populateAdminYearOptions() {
  const years = new Set(COMPARISON_YEARS);
  adminProjects.forEach(project => years.add(projectImplementationYear(project)));
  const sorted = [...years].filter(Number.isFinite).sort((a,b)=>a-b);
  $("#admin-year-select").innerHTML = [
    '<option value="all">All Years</option>',
    ...sorted.map(year => `<option value="${year}">AMP${year}</option>`)
  ].join("");
  const valid = new Set(["all", ...sorted.map(String)]);
  if (!valid.has(String(selectedAdminYear))) selectedAdminYear = valid.has(DEFAULT_ADMIN_YEAR) ? DEFAULT_ADMIN_YEAR : String(sorted.at(-1) || "all");
  $("#admin-year-select").value = String(selectedAdminYear);
  updateAdminYearBadge();
}
function handleAdminYearChange(event) {
  selectedAdminYear = event.target.value;
  updateAdminYearBadge();
  renderAdminOverview();
  renderAdminPortfolio();
  renderAdminExceptions();
}
function updateAdminYearBadge() {
  const badge=$("#admin-year-source-badge");
  if (badge) badge.textContent = selectedAdminYear === "all" ? "Live all years" : `Live AMP${selectedAdminYear}`;
}
function projectImplementationYear(project) {
  const year=Number(project?.implementation_year);
  return Number.isFinite(year) && year >= 2000 ? year : 2027;
}
function projectsForYear(year=selectedAdminYear) {
  if (String(year)==="all") return adminProjects.slice();
  return adminProjects.filter(project => projectImplementationYear(project)===Number(year));
}
function selectedYearLabel(year=selectedAdminYear) { return String(year)==="all" ? "All Years" : `AMP${year}`; }
function costBasisLabel(year=selectedAdminYear) {
  if (String(year)==="all") return "Year-specific portfolio cost";
  return Number(year)<=2026 ? "Approved budget" : "Effective post-challenge cost";
}
function numericValue(value) {
  if (value===null || value===undefined || value==="") return null;
  const n=Number(value); return Number.isFinite(n) ? n : null;
}
function projectPortfolioCost(project) {
  return projectImplementationYear(project)<=2026 ? (numericValue(project.approved_budget)||0) : (numericValue(project.estimated_cost_post_challenge)||0);
}
function hasPortfolioCost(project) {
  return projectImplementationYear(project)<=2026 ? numericValue(project.approved_budget)!==null : numericValue(project.estimated_cost_post_challenge)!==null;
}
function calculateProjectReadiness(project) {
  const checks=[
    Boolean(project.project_description || project.problem_opportunity),
    Boolean(project.start_date || project.target_date || extractProjectDateRange(project)),
    hasPortfolioCost(project),
    Boolean(project.priority_status && project.priority_status!=="Not Assessed"),
    Boolean(project.ict_classification && project.ict_classification!=="New - Pending ICT review"),
    Boolean(project.strategic_pillar),
    deriveHome31Fit(project)!=="Needs Validation"
  ];
  const checksMet=checks.filter(Boolean).length;
  return {project,checksMet,totalChecks:checks.length,score:Math.round(checksMet/checks.length*100)};
}
function calculateExecutiveMetrics(records=projectsForYear()) {
  const today=new Date().toISOString().slice(0,10), total=records.length;
  const sum=field=>records.reduce((s,p)=>s+(numericValue(p[field])||0),0);
  const originalCost=sum("estimated_cost"), effectiveCost=sum("estimated_cost_post_challenge"), proposedBudget=sum("proposed_budget_post_retreat"), approvedBudget=sum("approved_budget");
  const portfolioCost=records.reduce((s,p)=>s+projectPortfolioCost(p),0);
  const proposedBudgetCount=records.filter(p=>numericValue(p.proposed_budget_post_retreat)!==null).length;
  const approvedBudgetCount=records.filter(p=>numericValue(p.approved_budget)!==null).length;
  const readinessScores=records.map(calculateProjectReadiness);
  const strategicReadiness=total?Math.round(readinessScores.reduce((s,i)=>s+i.score,0)/total):0;
  const fullyReady=readinessScores.filter(i=>i.checksMet===i.totalChecks).length;
  const critical=records.filter(p=>p.risk_level==="Extreme"||p.status==="At Risk"||(p.target_date&&p.target_date<today&&p.status!=="Completed")||!p.accountable_owner);
  const watch=records.filter(p=>!critical.includes(p)&&(p.risk_level==="High"||Number(p.readiness_score||0)<70||Number(p.evidence_completeness||0)<70||p.ict_classification==="New - Pending ICT review"||(["Required","To be confirmed"].includes(p.hr_collaboration_status)&&!["Supported","Not required"].includes(p.hr_review_status))));
  const decisionCounts={
    selectedCost:records.filter(p=>!hasPortfolioCost(p)).length,
    approvedBudget:records.filter(p=>numericValue(p.approved_budget)===null).length,
    ict:records.filter(p=>p.ict_classification==="New - Pending ICT review"||((p.system_type&&p.system_type!=="Non System")&&!p.ict_classification)).length,
    hr:records.filter(p=>["Required","To be confirmed"].includes(p.hr_collaboration_status)&&!["Supported","Not required"].includes(p.hr_review_status)).length,
    evidence:records.filter(p=>Number(p.evidence_completeness||0)<70).length,
    priority:records.filter(p=>["Not Assessed","Watchlist / Under Review"].includes(p.priority_status)).length
  };
  return {
    records,total,originalCost,effectiveCost,proposedBudget,approvedBudget,portfolioCost,challengeReduction:originalCost-effectiveCost,
    portfolioCostCount:records.filter(hasPortfolioCost).length,proposedBudgetCount,approvedBudgetCount,
    strategicPriority:records.filter(p=>["Strategic Priority","Corporate Priority"].includes(p.priority_status)||p.priority==="Strategic").length,
    watchlist:records.filter(p=>["Watchlist / Under Review","Not Assessed"].includes(p.priority_status)).length,
    atRisk:records.filter(p=>p.status==="At Risk"||["High","Extreme"].includes(p.risk_level)).length,
    hrDependent:records.filter(p=>["Required","To be confirmed"].includes(p.hr_collaboration_status)).length,
    ictDependent:records.filter(p=>(p.system_type&&p.system_type!=="Non System")||!["N/A","None",null,undefined,""].includes(p.ict_classification)).length,
    overdue:records.filter(p=>p.target_date&&p.target_date<today&&p.status!=="Completed").length,
    departments:[...new Set(records.map(p=>p.department).filter(Boolean))],strategicReadiness,fullyReady,followUp:total-fullyReady,
    ownershipCompleteness:total?Math.round(records.filter(p=>p.executive_sponsor&&p.accountable_owner&&p.delivery_lead).length/total*100):0,
    evidenceAverage:total?Math.round(records.reduce((s,p)=>s+Number(p.evidence_completeness||0),0)/total):0,
    approvedBudgetCoverage:total?Math.round(approvedBudgetCount/total*100):0,
    critical,watch,stable:Math.max(0,total-critical.length-watch.length),decisionCounts,readinessScores
  };
}
function renderAdminOverview() {
  if (currentProfile?.role!=="super_admin") return;
  const metrics=calculateExecutiveMetrics();
  $("#admin-kpi-total").textContent=metrics.total;
  $("#admin-kpi-total-note").textContent=`${selectedYearLabel()} · ${metrics.departments.length} departments`;
  $("#admin-kpi-health").textContent=`${metrics.strategicReadiness}%`;
  $("#admin-kpi-health-note").textContent=`${metrics.fullyReady} initiatives meet all seven checks`;
  $("#admin-kpi-cost-label").textContent=costBasisLabel();
  $("#admin-kpi-effective-cost").textContent=compactRinggit(metrics.portfolioCost);
  $("#admin-kpi-effective-note").textContent=`${metrics.portfolioCostCount}/${metrics.total||0} records populated · ${selectedYearLabel()}`;
  $("#admin-kpi-reduction").textContent=compactRinggit(metrics.challengeReduction);
  $("#admin-kpi-reduction-note").textContent=metrics.originalCost?`${formatPercent(metrics.challengeReduction/metrics.originalCost*100)} challenge movement`:"Original estimate not yet populated";
  $("#admin-kpi-priority").textContent=metrics.strategicPriority;
  $("#admin-kpi-risk").textContent=metrics.atRisk;
  $("#admin-kpi-hr").textContent=metrics.hrDependent;
  $("#admin-kpi-ict").textContent=metrics.ictDependent;
  $("#admin-kpi-users").textContent=adminProfiles.length;
  $("#admin-assurance-ownership").textContent=`${metrics.ownershipCompleteness}%`;
  $("#admin-assurance-evidence").textContent=`${metrics.evidenceAverage}%`;
  $("#admin-assurance-budget").textContent=`${metrics.approvedBudgetCoverage}%`;
  $("#admin-assurance-overdue").textContent=metrics.overdue;
  renderExecutiveNarrative(metrics); renderExecutiveAttention(metrics); renderExecutiveBudget(metrics); renderExecutiveReadiness(metrics); renderExecutiveComparison(); renderExecutiveLists(metrics); renderAdminCharts(metrics); bindExecutiveRecordButtons();
}
function renderExecutiveNarrative(metrics) {
  const topDepartment=departmentCostData(metrics.records)[0], topPillar=pillarData("count",metrics.records)[0];
  const health=metrics.strategicReadiness>=85&&metrics.atRisk<=Math.max(1,metrics.total*.1)?"Healthy":metrics.strategicReadiness>=70?"Watch":"Intervention required";
  const badge=$("#admin-portfolio-health-badge"); badge.textContent=`${selectedYearLabel()} · ${health}`; badge.className=`executive-status-chip ${health==="Healthy"?"good":health==="Watch"?"watch":"critical"}`;
  $("#admin-executive-insight").textContent=metrics.total?`${selectedYearLabel()} contains ${metrics.total} initiatives across ${metrics.departments.length} departments, with strategic readiness of ${metrics.strategicReadiness}%. ${costBasisLabel()} is ${formatRinggit(metrics.portfolioCost)}, with ${metrics.portfolioCostCount} records populated. ${topPillar?topPillar.label+" carries the largest initiative concentration":"Pillar concentration is not yet available"}${topDepartment?", while "+topDepartment.label+" has the highest selected cost exposure.":"."}`:`No initiative records are currently entered for ${selectedYearLabel()}.`;
  $("#admin-insight-facts").innerHTML=`<article><strong>${metrics.strategicPriority} strategic-priority initiatives</strong><span>${metrics.watchlist} remain on watchlist or unassessed.</span></article><article><strong>${metrics.ownershipCompleteness}% ownership completeness</strong><span>Executive sponsor, accountable owner and delivery lead.</span></article><article><strong>${metrics.evidenceAverage}% evidence maturity</strong><span>Average evidence completeness for ${selectedYearLabel()}.</span></article>`;
}
function renderExecutiveAttention(metrics) {
  $("#admin-attention-critical").textContent=metrics.critical.length; $("#admin-attention-watch").textContent=metrics.watch.length; $("#admin-attention-stable").textContent=metrics.stable;
  const rows=[[`${costBasisLabel()} still blank`,metrics.decisionCounts.selectedCost],["Approved budget still blank",metrics.decisionCounts.approvedBudget],["ICT review / classification pending",metrics.decisionCounts.ict],["HR review or collaboration pending",metrics.decisionCounts.hr],["Evidence completeness below 70%",metrics.decisionCounts.evidence],["Priority decision outstanding",metrics.decisionCounts.priority]];
  $("#admin-attention-summary").innerHTML=rows.map(([l,v])=>`<div class="attention-row"><span>${escapeHtml(l)}</span><strong>${v}</strong></div>`).join("");
}
function renderExecutiveBudget(metrics) {
  $("#admin-budget-metrics").innerHTML=`<article><strong>${formatRinggit(metrics.challengeReduction)}</strong><span>Challenge movement versus original estimate</span></article><article><strong>${metrics.proposedBudgetCount}/${metrics.total}</strong><span>Initiatives with proposed budget populated</span></article><article><strong>${metrics.approvedBudgetCount}/${metrics.total}</strong><span>Initiatives with approved budget populated</span></article>`;
  $("#admin-budget-footnote").textContent=`${selectedYearLabel()} contains ${metrics.total} records. The headline KPI uses ${costBasisLabel().toLowerCase()}; the chart displays all four financial stages where populated.`;
}
function renderExecutiveReadiness(metrics) {
  $("#admin-readiness-gauge-value").textContent=`${metrics.strategicReadiness}%`;
  const departments=departmentReadinessData(metrics.records).slice(0,10);
  $("#admin-department-readiness-bars").innerHTML=departments.length?departments.map(i=>`<div class="department-readiness-row"><span>${escapeHtml(i.label)}</span><div class="department-readiness-track"><i style="width:${i.value}%"></i></div><strong>${i.value}%</strong></div>`).join(""):'<div class="executive-empty">No departmental readiness data for this year.</div>';
  $("#admin-readiness-footnote").innerHTML=`<strong>${metrics.fullyReady}</strong> ${selectedYearLabel()} initiatives meet all seven checks; <strong>${metrics.followUp}</strong> have at least one follow-up.`;
}
function comparisonMetricsForYear(year) {
  const records=projectsForYear(String(year));
  return {year,records,portfolioItems:records.length,portfolioCost:records.reduce((s,p)=>s+projectPortfolioCost(p),0),strategicPriority:records.filter(p=>["Strategic Priority","Corporate Priority"].includes(p.priority_status)||p.priority==="Strategic").length,watchlist:records.filter(p=>["Watchlist / Under Review","Not Assessed"].includes(p.priority_status)).length,zeroBudgetOrConfirmedCost:records.filter(p=>!hasPortfolioCost(p)||projectPortfolioCost(p)===0).length,departments:new Set(records.map(p=>p.department).filter(Boolean)).size};
}
function renderExecutiveComparison() {
  const a=comparisonMetricsForYear(2026), b=comparisonMetricsForYear(2027);
  const cards=[["Portfolio items","portfolioItems",String],["Portfolio cost basis","portfolioCost",compactRinggit],["Priority / corporate priority","strategicPriority",String],["Watchlist / under review","watchlist",String],["Zero / unconfirmed cost","zeroBudgetOrConfirmedCost",String],["Departments represented","departments",String]];
  $("#admin-comparison-grid").innerHTML=cards.map(([label,key,fmt])=>{const old=a[key],now=b[key],d=now-old,p=old?d/old*100:0;return `<article class="comparison-card"><span>${escapeHtml(label)}</span><div class="comparison-values"><div><span>AMP2026</span><strong>${fmt(old)}</strong></div><div><span>AMP2027</span><strong>${fmt(now)}</strong></div></div><div class="comparison-delta ${d>0?"negative":""}">${d>=0?"+":""}${key==="portfolioCost"?compactRinggit(d):d.toLocaleString("en-MY")} (${d>=0?"+":""}${p.toFixed(1)}%)</div></article>`;}).join("");
  const badge=$("#admin-comparison-source-status");
  if(!a.records.length&&!b.records.length){badge.textContent="No live year data";badge.className="executive-status-chip critical";}else if(!a.records.length){badge.textContent="AMP2026 data pending";badge.className="executive-status-chip watch";}else if(!b.records.length){badge.textContent="AMP2027 data pending";badge.className="executive-status-chip watch";}else{badge.textContent="Live Supabase comparison";badge.className="executive-status-chip good";}
  $("#admin-comparison-notes").innerHTML=`<div class="comparison-note"><strong>AMP2026 source:</strong> ${a.records.length} live records. Portfolio cost uses Approved Budget.</div><div class="comparison-note"><strong>AMP2027 source:</strong> ${b.records.length} live records. Portfolio cost uses Estimated Cost Post Challenge.</div><div class="comparison-note"><strong>No fixed baseline:</strong> Adding, editing or deleting year records updates this comparison automatically.</div>`;
}
function renderExecutiveLists(metrics) {
  const records=metrics.records;
  const decisions=[[`${costBasisLabel()} coverage`,metrics.decisionCounts.selectedCost],["Budget approval coverage",metrics.decisionCounts.approvedBudget],["ICT assessment",metrics.decisionCounts.ict],["HR and workforce review",metrics.decisionCounts.hr],["Evidence closure",metrics.decisionCounts.evidence],["Priority determination",metrics.decisionCounts.priority]].filter(x=>x[1]>0);
  $("#admin-decision-queue").innerHTML=decisions.length?decisions.map(([t,c])=>`<div class="executive-list-item"><div><strong>${escapeHtml(t)}</strong><span>${c} initiatives require follow-up in ${selectedYearLabel()}.</span></div><em>${c}</em></div>`).join(""):'<div class="executive-empty">No executive decision queue is currently outstanding.</div>';
  const top=records.slice().sort((a,b)=>projectPortfolioCost(b)-projectPortfolioCost(a)).filter(p=>projectPortfolioCost(p)>0).slice(0,5);
  $("#admin-top-cost-list").innerHTML=top.length?top.map(p=>`<div class="executive-list-item"><div><strong>${escapeHtml(p.initiative_name)}</strong><span>AMP${projectImplementationYear(p)} · ${escapeHtml(p.department||"No department")}</span></div><button data-executive-open="${p.id}" type="button">${compactRinggit(projectPortfolioCost(p))}</button></div>`).join(""):'<div class="executive-empty">No selected-year cost records are available.</div>';
  const order={Extreme:4,High:3,Medium:2,Low:1}, risk=records.slice().sort((a,b)=>(order[b.risk_level]||0)-(order[a.risk_level]||0)||Number(a.readiness_score||0)-Number(b.readiness_score||0)).slice(0,5);
  $("#admin-top-risk-list").innerHTML=risk.length?risk.map(p=>`<div class="executive-list-item"><div><strong>${escapeHtml(p.initiative_name)}</strong><span>AMP${projectImplementationYear(p)} · ${escapeHtml(p.department||"No department")} · ${Number(p.readiness_score||0)}% readiness</span></div><button data-executive-open="${p.id}" type="button">${escapeHtml(p.risk_level||"Not rated")}</button></div>`).join(""):'<div class="executive-empty">No risk records are available.</div>';
}
function renderAdminCharts(metrics=calculateExecutiveMetrics()) {
  ["adminBudgetJourney","adminReadinessGauge","adminDeliveryLoad","adminCostBenefit","adminPillar","adminHome31Fit","adminDepartmentCost"].forEach(k=>charts[k]?.destroy());
  if(typeof Chart==="undefined") return;
  const records=metrics.records, common=executiveChartOptions();
  charts.adminBudgetJourney=new Chart($("#admin-budget-journey-chart"),{type:"bar",data:{labels:["Original Estimate","Post-Challenge Cost","Proposed Budget","Approved Budget"],datasets:[{data:[metrics.originalCost,metrics.effectiveCost,metrics.proposedBudget,metrics.approvedBudget],backgroundColor:[EXECUTIVE_COLORS.blue,EXECUTIVE_COLORS.gold,EXECUTIVE_COLORS.teal,EXECUTIVE_COLORS.green],borderRadius:8,maxBarThickness:88}]},options:{...common,plugins:{...common.plugins,legend:{display:false},tooltip:{callbacks:{label:c=>formatRinggit(c.raw)}}},scales:executiveMoneyScales()}});
  charts.adminReadinessGauge=new Chart($("#admin-readiness-gauge-chart"),{type:"doughnut",data:{datasets:[{data:[metrics.strategicReadiness,Math.max(0,100-metrics.strategicReadiness)],backgroundColor:[EXECUTIVE_COLORS.teal,"#294a62"],borderWidth:0,circumference:230,rotation:245,cutout:"78%"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}}}});
  const delivery=quarterlyDeliveryData(records);
  charts.adminDeliveryLoad=new Chart($("#admin-delivery-load-chart"),{data:{labels:delivery.labels,datasets:[{type:"bar",label:"All Active",data:delivery.active,backgroundColor:"rgba(87,153,155,.85)",borderRadius:5},{type:"line",label:"Strategic Priority",data:delivery.priority,borderColor:EXECUTIVE_COLORS.gold,backgroundColor:EXECUTIVE_COLORS.gold,pointRadius:4,borderWidth:2,tension:.25}]},options:{...common,scales:executiveCountScales()}});
  const groups=["Strategic Priority","Watchlist / Under Review","Recommended","Not Classified"],colors={"Strategic Priority":"#5978c7","Watchlist / Under Review":"#7fae71",Recommended:EXECUTIVE_COLORS.gold,"Not Classified":EXECUTIVE_COLORS.red};
  charts.adminCostBenefit=new Chart($("#admin-cost-benefit-chart"),{type:"bubble",data:{datasets:groups.map(g=>({label:g,data:records.filter(p=>normalizePriorityGroup(p)===g).map(p=>({x:projectPortfolioCost(p),y:Number(p.cba_ratio||0),r:p.ict_classification==="High"||p.people_impact_level==="Enterprise-wide"?22:p.ict_classification==="Medium"||p.people_impact_level==="High"?16:10,project:p})),backgroundColor:colors[g]+"cc",borderColor:colors[g],borderWidth:1}))},options:{...common,onClick:(_e,elements,chart)=>{if(elements.length){const point=chart.data.datasets[elements[0].datasetIndex].data[elements[0].index];if(point?.project?.id)openInitiativeModal(point.project.id);}},scales:{x:{beginAtZero:true,grid:{color:EXECUTIVE_COLORS.grid},ticks:{color:EXECUTIVE_COLORS.text,callback:v=>compactRinggit(v)},title:{display:true,text:`${selectedYearLabel()} portfolio cost basis`,color:EXECUTIVE_COLORS.text}},y:{beginAtZero:true,grid:{color:EXECUTIVE_COLORS.grid},ticks:{color:EXECUTIVE_COLORS.text},title:{display:true,text:"CBA ratio",color:EXECUTIVE_COLORS.text}}}}});
  renderExecutivePillarChart(records);
  const fits=["Enabler","Supporting Activity","Core Initiative","Duplicate / Consolidate","Needs Validation","BAU · Supporting Enhancement","Policy Review"];
  charts.adminHome31Fit=new Chart($("#admin-home31-fit-chart"),{type:"doughnut",data:{labels:fits,datasets:[{data:fits.map(f=>records.filter(p=>deriveHome31Fit(p)===f).length),backgroundColor:["#d1ad63","#7f99af","#57999b","#6f86a0","#d9b769","#a76a6f","#8aa1b1"],borderColor:"#102f49",borderWidth:4,cutout:"62%"}]},options:common});
  renderLiveDepartmentComparison();
  $("#admin-delivery-footnote").textContent=`${selectedYearLabel()} quarter load uses action-plan, start and target dates. Undated initiatives are excluded.`;
  $("#admin-matrix-footnote").textContent=`Click a bubble to open its record. Cost follows ${costBasisLabel().toLowerCase()}.`;
}
function renderLiveDepartmentComparison() {
  charts.adminDepartmentCost?.destroy(); if(typeof Chart==="undefined") return;
  const d26=departmentCostData(projectsForYear("2026")),d27=departmentCostData(projectsForYear("2027")),m26=new Map(d26.map(i=>[i.label,i.value])),m27=new Map(d27.map(i=>[i.label,i.value]));
  const labels=[...new Set([...m26.keys(),...m27.keys()])].map(label=>({label,total:(m26.get(label)||0)+(m27.get(label)||0)})).sort((a,b)=>b.total-a.total).slice(0,12).map(i=>i.label);
  charts.adminDepartmentCost=new Chart($("#admin-department-cost-chart"),{type:"bar",data:{labels,datasets:[{label:"AMP2026 Approved Budget",data:labels.map(l=>m26.get(l)||0),backgroundColor:EXECUTIVE_COLORS.blue,borderRadius:6},{label:"AMP2027 Post-Challenge Cost",data:labels.map(l=>m27.get(l)||0),backgroundColor:EXECUTIVE_COLORS.gold,borderRadius:6}]},options:{...executiveChartOptions(),indexAxis:"y",onClick:(_e,elements)=>{if(!elements.length)return;selectedAdminYear=elements[0].datasetIndex===0?"2026":"2027";$("#admin-year-select").value=selectedAdminYear;updateAdminYearBadge();$("#admin-search").value=labels[elements[0].index];showModule("admin-portfolio");renderAdminPortfolio();},scales:executiveMoneyScales()}});
  const t26=projectsForYear("2026").reduce((s,p)=>s+projectPortfolioCost(p),0),t27=projectsForYear("2027").reduce((s,p)=>s+projectPortfolioCost(p),0);
  $("#admin-cost-concentration-footnote").textContent=`Live sources: AMP2026 approved budget ${formatRinggit(t26)}; AMP2027 post-challenge cost ${formatRinggit(t27)}. Click a bar to open that year and department.`;
}
function renderExecutivePillarChart(records=projectsForYear()) {
  charts.adminPillar?.destroy(); if(typeof Chart==="undefined")return;
  const data=pillarData(pillarMetric,records);
  charts.adminPillar=new Chart($("#admin-pillar-chart"),{type:"bar",data:{labels:data.map(i=>shortPillar(i.label)),datasets:[{label:pillarMetric==="count"?"Initiatives":"Portfolio cost",data:data.map(i=>i.value),backgroundColor:EXECUTIVE_COLORS.gold,borderRadius:7}]},options:{...executiveChartOptions(),indexAxis:"y",onClick:(_e,elements)=>{if(!elements.length)return;$("#admin-pillar-filter").value=data[elements[0].index].label;showModule("admin-portfolio");renderAdminPortfolio();},plugins:{...executiveChartOptions().plugins,legend:{display:false}},scales:pillarMetric==="cost"?executiveMoneyScales():executiveCountScales()}});
}
function pillarData(metric="count",records=projectsForYear()) {return pillars.map(p=>{const related=records.filter(r=>r.strategic_pillar===p);return{label:p,value:metric==="cost"?related.reduce((s,r)=>s+projectPortfolioCost(r),0):related.length};}).sort((a,b)=>b.value-a.value);}
function departmentCostData(records=projectsForYear()) {const map=new Map();records.forEach(p=>{const d=p.department||"Not recorded";map.set(d,(map.get(d)||0)+projectPortfolioCost(p));});return[...map.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);}
function departmentReadinessData(records=projectsForYear()) {const map=new Map();records.forEach(p=>{const d=p.department||"Not recorded",c=map.get(d)||{total:0,count:0};c.total+=calculateProjectReadiness(p).score;c.count++;map.set(d,c);});return[...map.entries()].map(([label,d])=>({label,value:Math.round(d.total/d.count)})).sort((a,b)=>a.value-b.value);}
function quarterlyDeliveryData(records=projectsForYear()) {const ranges=records.map(project=>({project,range:extractProjectDateRange(project)})).filter(i=>i.range);const fallback=selectedAdminYear==="all"?new Date().getFullYear():Number(selectedAdminYear);const min=ranges.length?Math.min(...ranges.map(i=>i.range.start.getFullYear())):fallback,max=ranges.length?Math.max(...ranges.map(i=>i.range.end.getFullYear())):fallback,quarters=[];for(let year=min;year<=Math.min(min+4,Math.max(min,max));year++)for(let q=1;q<=4;q++){const sm=(q-1)*3;quarters.push({label:`${year} Q${q}`,start:new Date(year,sm,1),end:new Date(year,sm+3,0,23,59,59)});}return{labels:quarters.map(q=>q.label),active:quarters.map(q=>ranges.filter(i=>i.range.start<=q.end&&i.range.end>=q.start).length),priority:quarters.map(q=>ranges.filter(i=>i.range.start<=q.end&&i.range.end>=q.start&&normalizePriorityGroup(i.project)==="Strategic Priority").length)};}
function getFilteredAdminPortfolioRecords() {const query=($("#admin-search").value||"").toLowerCase(),status=$("#admin-status-filter").value||"",pillar=$("#admin-pillar-filter").value||"",risk=$("#admin-risk-filter").value||"";return projectsForYear().filter(p=>{const profile=profileFor(p.created_by),hay=[projectImplementationYear(p),p.initiative_name,p.accountable_owner,p.executive_sponsor,p.delivery_lead,p.department,p.initiative_category,p.system_type,p.priority_status,profile?.full_name,profile?.email].join(" ").toLowerCase();return(!query||hay.includes(query))&&(!status||p.status===status)&&(!pillar||p.strategic_pillar===pillar)&&(!risk||p.risk_level===risk);});}
function renderAdminPortfolio() {
  if(currentProfile?.role!=="super_admin")return;const yearRecords=projectsForYear(),filtered=getFilteredAdminPortfolioRecords(),cost=filtered.reduce((s,p)=>s+projectPortfolioCost(p),0),approved=filtered.filter(p=>numericValue(p.approved_budget)!==null).length,atRisk=filtered.filter(p=>p.status==="At Risk"||["High","Extreme"].includes(p.risk_level)).length,ready=filtered.filter(p=>Number(p.readiness_score||0)>=80&&!["High","Extreme"].includes(p.risk_level)&&p.status!=="At Risk").length,today=new Date().toISOString().slice(0,10),ownership=filtered.filter(p=>p.executive_sponsor&&p.accountable_owner&&p.delivery_lead).length,evidence=filtered.length?Math.round(filtered.reduce((s,p)=>s+Number(p.evidence_completeness||0),0)/filtered.length):0,ict=filtered.filter(p=>p.ict_classification==="New - Pending ICT review"||((p.system_type&&p.system_type!=="Non System")&&!p.ict_classification)).length,hr=filtered.filter(p=>["Required","To be confirmed"].includes(p.hr_collaboration_status)&&!["Supported","Not required"].includes(p.hr_review_status)).length,overdue=filtered.filter(p=>p.target_date&&p.target_date<today&&p.status!=="Completed").length;
  $("#portfolio-kpi-total").textContent=yearRecords.length;$("#portfolio-kpi-filtered").textContent=filtered.length;$("#portfolio-kpi-cost").textContent=compactRinggit(cost);$("#portfolio-kpi-budget").textContent=`${filtered.length?Math.round(approved/filtered.length*100):0}%`;$("#portfolio-kpi-risk").textContent=atRisk;$("#portfolio-kpi-ready").textContent=ready;$("#portfolio-table-count").textContent=`${selectedYearLabel()} · ${filtered.length} record${filtered.length===1?"":"s"}`;$("#portfolio-assurance-ownership").textContent=`${filtered.length?Math.round(ownership/filtered.length*100):0}%`;$("#portfolio-assurance-evidence").textContent=`${evidence}%`;$("#portfolio-assurance-ict").textContent=ict;$("#portfolio-assurance-hr").textContent=hr;$("#portfolio-assurance-overdue").textContent=overdue;
  const filterCount=[$("#admin-search").value,$("#admin-status-filter").value,$("#admin-pillar-filter").value,$("#admin-risk-filter").value].filter(Boolean).length;$("#portfolio-selection-badge").textContent=filterCount?`${selectedYearLabel()} · ${filterCount} active filters`:selectedYearLabel();
  const topD=aggregateFiltered(filtered,p=>p.department||"Not recorded",projectPortfolioCost)[0],topP=aggregateFiltered(filtered,p=>p.strategic_pillar||"Not recorded",()=>1)[0];
  $("#portfolio-selection-insight").textContent=filtered.length?`${selectedYearLabel()} selection contains ${filtered.length} initiatives with ${formatRinggit(cost)} under the ${costBasisLabel().toLowerCase()} rule. ${atRisk} require risk attention and ${ready} meet the delivery-ready rule.`:`No ${selectedYearLabel()} initiative matches the selected filters.`;
  $("#portfolio-selection-facts").innerHTML=`<article><strong>${escapeHtml(topD?.label||"No data")}</strong><span>Highest selected cost: ${topD?compactRinggit(topD.value):"RM0"}</span></article><article><strong>${escapeHtml(shortPillar(topP?.label||"No data"))}</strong><span>Largest concentration: ${topP?.value||0} records</span></article><article><strong>${evidence}% evidence maturity</strong><span>${hr} HR and ${ict} ICT follow-ups remain.</span></article>`;
  $("#admin-portfolio-table tbody").innerHTML=filtered.length?filtered.map(p=>{const profile=profileFor(p.created_by);return`<tr><td><span class="portfolio-year-pill">AMP${projectImplementationYear(p)}</span></td><td><strong>${escapeHtml(p.initiative_name)}</strong></td><td>${escapeHtml(profile?.full_name||profile?.email||"Unknown")}</td><td>${escapeHtml(p.department)}</td><td>${escapeHtml(p.initiative_category||"Not recorded")}</td><td>${escapeHtml(p.system_type||"Not recorded")}</td><td>${escapeHtml(p.priority_status||"Not assessed")}</td><td>${escapeHtml(p.strategic_pillar)}</td><td><span class="status-pill">${escapeHtml(p.status)}</span></td><td><span class="risk-pill">${escapeHtml(p.risk_level)}</span></td><td>${formatRinggit(p.approved_budget)}</td><td>${Number(p.readiness_score||0)}%</td><td>${progressBar(p.progress)}</td><td><button class="text-button" data-admin-edit="${p.id}" type="button">Edit</button></td></tr>`;}).join(""):'<tr><td colspan="14">No records match the active year and filters.</td></tr>';
  $$('[data-admin-edit]').forEach(b=>b.addEventListener('click',()=>openInitiativeModal(b.dataset.adminEdit)));
}
function exportAdminPortfolioCsv() {if(currentProfile?.role!=="super_admin")return;const records=getFilteredAdminPortfolioRecords(),headers=["Implementation Year","Initiative","Department","Executive Sponsor","Accountable Owner","Delivery Lead","Category","System Type","Priority Status","Strategic Pillar","Status","Risk","Year-Specific Portfolio Cost","Approved Budget","Readiness","Progress","Evidence Completeness"],rows=records.map(p=>[projectImplementationYear(p),p.initiative_name,p.department,p.executive_sponsor,p.accountable_owner,p.delivery_lead,p.initiative_category,p.system_type,p.priority_status,p.strategic_pillar,p.status,p.risk_level,projectPortfolioCost(p),p.approved_budget??"",p.readiness_score??0,p.progress??0,p.evidence_completeness??0]),csv=[headers,...rows].map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(',')).join('\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`HOME31-${selectedYearLabel().replaceAll(' ','-')}-Portfolio-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);}
function renderAdminExceptions() {
  if(currentProfile?.role!=="super_admin")return;const records=projectsForYear(),today=new Date().toISOString().slice(0,10),risk=records.filter(p=>["High","Extreme"].includes(p.risk_level)),readiness=records.filter(p=>Number(p.readiness_score||0)<70),overdue=records.filter(p=>p.target_date&&p.target_date<today&&p.status!=="Completed"),hrPending=records.filter(p=>["Required","To be confirmed"].includes(p.hr_collaboration_status)&&!["Supported","Not required"].includes(p.hr_review_status)),ictPending=records.filter(p=>p.ict_classification==="New - Pending ICT review"||((p.system_type&&p.system_type!=="Non System")&&!p.ict_classification)),evidence=records.filter(p=>Number(p.evidence_completeness||0)<70);
  $("#admin-exception-risk-count").textContent=risk.length;$("#admin-exception-readiness-count").textContent=readiness.length;$("#admin-exception-overdue-count").textContent=overdue.length;$("#admin-exception-hr-count").textContent=hrPending.length;$("#admin-exception-ict-count").textContent=ictPending.length;$("#admin-exception-evidence-count").textContent=evidence.length;$("#admin-exception-risk-badge").textContent=risk.length;$("#admin-exception-readiness-badge").textContent=readiness.length;$("#admin-exception-overdue-badge").textContent=overdue.length;
  $("#admin-exception-risk-list").innerHTML=renderExceptionList(risk,p=>`AMP${projectImplementationYear(p)} · ${p.risk_level} risk · ${p.status}`);$("#admin-exception-readiness-list").innerHTML=renderExceptionList(readiness,p=>`AMP${projectImplementationYear(p)} · ${Number(p.readiness_score||0)}% readiness`);$("#admin-exception-overdue-list").innerHTML=renderExceptionList(overdue,p=>`AMP${projectImplementationYear(p)} · Target ${p.target_date}`);$("#admin-exception-hr-list").innerHTML=renderExceptionList(hrPending,p=>`AMP${projectImplementationYear(p)} · ${p.hr_review_status||"Not reviewed"}`);$("#admin-exception-ict-list").innerHTML=renderExceptionList(ictPending,p=>`AMP${projectImplementationYear(p)} · ${p.ict_classification||"Classification missing"}`);$("#admin-exception-evidence-list").innerHTML=renderExceptionList(evidence,p=>`AMP${projectImplementationYear(p)} · ${Number(p.evidence_completeness||0)}% evidence`);
  const critical=new Set([...risk.filter(p=>p.risk_level==="Extreme"),...overdue.filter(p=>p.status==="At Risk")]),watch=new Set([...risk,...readiness,...overdue,...hrPending,...ictPending,...evidence]);critical.forEach(p=>watch.delete(p));const stable=Math.max(0,records.length-critical.size-watch.size),treatment=risk.length?Math.round(risk.filter(p=>p.next_action&&Number(p.readiness_score||0)>=60).length/risk.length*100):100,avg=records.length?Math.round(records.reduce((s,p)=>s+Number(p.readiness_score||0),0)/records.length):0;
  $("#exception-assurance-stable").textContent=stable;$("#exception-assurance-watch").textContent=watch.size;$("#exception-assurance-critical").textContent=critical.size;$("#exception-assurance-treatment").textContent=`${treatment}%`;$("#exception-assurance-average").textContent=`${avg}%`;
  renderAdminExceptionCharts({records,risk,readiness,overdue,hrPending,ictPending,evidence});$$('[data-exception-open]').forEach(b=>b.addEventListener('click',()=>openInitiativeModal(b.dataset.exceptionOpen)));
}
function renderAdminExceptionCharts(data) {
  charts.adminExceptionRisk?.destroy();charts.adminExceptionHealth?.destroy();if(typeof Chart==="undefined")return;const risks=["Low","Medium","High","Extreme"];
  charts.adminExceptionRisk=new Chart($("#admin-exception-risk-chart"),{type:"doughnut",data:{labels:risks,datasets:[{data:risks.map(r=>data.records.filter(p=>p.risk_level===r).length),backgroundColor:["#6ca69b","#7f99af","#d1ad63","#d26066"],borderColor:"#102f49",borderWidth:4,cutout:"62%"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{color:EXECUTIVE_COLORS.text,usePointStyle:true,boxWidth:8,font: { size: 12 }}}}}});
  charts.adminExceptionHealth=new Chart($("#admin-exception-health-chart"),{type:"bar",data:{labels:["Risk","Low readiness","Overdue","HR","ICT","Evidence"],datasets:[{data:[data.risk.length,data.readiness.length,data.overdue.length,data.hrPending.length,data.ictPending.length,data.evidence.length],backgroundColor:["#d26066","#d1ad63","#b97859","#57999b","#7f99af","#6f86a0"],borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:EXECUTIVE_COLORS.text,font: { size: 12 }}},y:{beginAtZero:true,grid:{color:EXECUTIVE_COLORS.grid},ticks:{color:EXECUTIVE_COLORS.text,precision:0}}}}});
}


/* ================================================================
   V7.6 DISPLAY SETTINGS AND RESPONSIVE READABILITY
   ================================================================ */

function initialiseDisplaySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_KEY) || "{}");
    if (DISPLAY_MODES.includes(saved.size)) currentDisplaySize = saved.size;
    highContrastEnabled = Boolean(saved.highContrast);
  } catch (_error) {
    currentDisplaySize = "comfortable";
    highContrastEnabled = false;
  }

  applyDisplaySettings(false);

  $("#display-settings-toggle").addEventListener("click", toggleDisplaySettingsPanel);
  $("#display-settings-close").addEventListener("click", closeDisplaySettingsPanel);
  $("#display-settings-reset").addEventListener("click", resetDisplaySettings);
  $("#display-high-contrast").addEventListener("change", event => {
    highContrastEnabled = event.target.checked;
    applyDisplaySettings();
  });

  $$("[data-display-size]").forEach(button => {
    button.addEventListener("click", () => {
      currentDisplaySize = button.dataset.displaySize;
      applyDisplaySettings();
    });
  });

  document.addEventListener("click", event => {
    const settings = $("#display-settings");
    if (settings && !settings.contains(event.target)) closeDisplaySettingsPanel();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeDisplaySettingsPanel();

    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      toggleDisplaySettingsPanel();
    }
  });
}

function applyDisplaySettings(announce = true) {
  document.documentElement.dataset.displaySize = currentDisplaySize;
  document.documentElement.dataset.contrast = highContrastEnabled ? "high" : "normal";

  $$("[data-display-size]").forEach(button => {
    const active = button.dataset.displaySize === currentDisplaySize;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });

  const contrastToggle = $("#display-high-contrast");
  if (contrastToggle) contrastToggle.checked = highContrastEnabled;

  const labels = {
    standard: "Standard display",
    comfortable: "Comfortable display",
    large: "Large display"
  };
  const status = `${labels[currentDisplaySize]}${highContrastEnabled ? " with high contrast" : ""} is active.`;
  const statusElement = $("#display-settings-status");
  if (statusElement) statusElement.textContent = status;

  try {
    localStorage.setItem(
      DISPLAY_SETTINGS_KEY,
      JSON.stringify({
        size: currentDisplaySize,
        highContrast: highContrastEnabled
      })
    );
  } catch (_error) {
    // The interface still works when local storage is unavailable.
  }

  updateChartReadability();
  scheduleResponsiveTableEnhancement();

  if (announce && typeof showToast === "function") {
    showToast(status);
  }
}

function resetDisplaySettings() {
  currentDisplaySize = "comfortable";
  highContrastEnabled = false;
  applyDisplaySettings();
}

function toggleDisplaySettingsPanel() {
  const panel = $("#display-settings-panel");
  const toggle = $("#display-settings-toggle");
  const opening = panel.classList.contains("hidden");

  panel.classList.toggle("hidden", !opening);
  toggle.setAttribute("aria-expanded", String(opening));

  if (opening) {
    window.setTimeout(() => {
      const active = $(`[data-display-size="${currentDisplaySize}"]`);
      active?.focus();
    }, 20);
  }
}

function closeDisplaySettingsPanel() {
  const panel = $("#display-settings-panel");
  const toggle = $("#display-settings-toggle");
  if (!panel || panel.classList.contains("hidden")) return;

  panel.classList.add("hidden");
  toggle?.setAttribute("aria-expanded", "false");
}

function initialiseResponsiveTables() {
  scheduleResponsiveTableEnhancement();

  const platform = $("#platform");
  if (!platform || responsiveTableObserver) return;

  responsiveTableObserver = new MutationObserver(() => {
    scheduleResponsiveTableEnhancement();
  });

  responsiveTableObserver.observe(platform, {
    childList: true,
    subtree: true
  });
}

function scheduleResponsiveTableEnhancement() {
  if (tableEnhancementScheduled) return;
  tableEnhancementScheduled = true;

  window.requestAnimationFrame(() => {
    tableEnhancementScheduled = false;
    enhanceResponsiveTables();
  });
}

function enhanceResponsiveTables() {
  $$("table").forEach(table => {
    table.classList.add("responsive-table");

    const headers = [...table.querySelectorAll("thead th")]
      .map(header => header.textContent.trim());

    [...table.querySelectorAll("tbody tr")].forEach(row => {
      [...row.children].forEach((cell, index) => {
        if (!cell.dataset.label) {
          cell.dataset.label = headers[index] || `Field ${index + 1}`;
        }
      });
    });
  });
}

function chartFontSize() {
  if (currentDisplaySize === "large") return 15;
  if (currentDisplaySize === "standard") return 11;
  return 13;
}

function updateChartReadability() {
  if (typeof Chart === "undefined") return;

  const size = chartFontSize();
  Chart.defaults.font.family =
    '"IBM Plex Sans", "Aptos", "Segoe UI Variable", "Segoe UI", Arial, sans-serif';
  Chart.defaults.font.size = size;
  Chart.defaults.color = highContrastEnabled ? "#eef6fa" : Chart.defaults.color;

  Object.values(charts).forEach(chart => {
    if (!chart?.options) return;

    const legendLabels = chart.options.plugins?.legend?.labels;
    if (legendLabels) {
      legendLabels.font = {
        ...(typeof legendLabels.font === "object" ? legendLabels.font : {}),
        family: Chart.defaults.font.family,
        size
      };
      legendLabels.color = highContrastEnabled ? "#eef6fa" : legendLabels.color;
      legendLabels.padding = Math.max(Number(legendLabels.padding || 12), 14);
    }

    Object.values(chart.options.scales || {}).forEach(scale => {
      if (scale?.ticks) {
        scale.ticks.font = {
          ...(typeof scale.ticks.font === "object" ? scale.ticks.font : {}),
          family: Chart.defaults.font.family,
          size
        };
        if (highContrastEnabled) scale.ticks.color = "#eef6fa";
      }

      if (scale?.title) {
        scale.title.font = {
          ...(typeof scale.title.font === "object" ? scale.title.font : {}),
          family: Chart.defaults.font.family,
          size: size + 1,
          weight: "600"
        };
        if (highContrastEnabled) scale.title.color = "#eef6fa";
      }
    });

    chart.resize();
    chart.update("none");
  });
}
