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

// Configurable AMP2026 management-comparison baseline from the reference dashboard.
const AMP2026_BASELINE = {
  portfolioItems: 71,
  portfolioCost: 33027240.80,
  strategicPriority: 21,
  watchlist: 27,
  zeroBudgetOrConfirmedCost: 30,
  departments: 18,
  departmentApprovedBudget: {
    "Finance": 11800000,
    "Monitoring and Recovery": 10100000,
    "Process and Operational Excellence": 5500000,
    "Credit Admin 2": 1500000,
    "Risk Management": 900000,
    "Treasury": 1700000,
    "Information Communication Technology": 650000,
    "Legal and Secretariat": 200000,
    "Integrity and Compliance": 150000
  }
};

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


let currentUser = null;
let currentProfile = null;
let userProjects = [];
let adminProjects = [];
let adminProfiles = [];
let charts = {};
let currentInitiativeFormStep = 1;

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
  $("#admin-overview-refresh").addEventListener("click", loadAdminData);
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
  populateOwnerOptions();
  renderAdminOverview();
  renderAdminPortfolio();
  renderAdminUsers();
  renderAdminExceptions();
}

function renderAdminOverview() {
  if (currentProfile?.role !== "super_admin") return;

  const metrics = calculateExecutiveMetrics();
  const total = metrics.total;

  $("#admin-kpi-total").textContent = total;
  $("#admin-kpi-total-note").textContent = `${metrics.departments.length} departments represented`;
  $("#admin-kpi-health").textContent = `${metrics.strategicReadiness}%`;
  $("#admin-kpi-health-note").textContent = `${metrics.fullyReady} initiatives meet all seven checks`;
  $("#admin-kpi-effective-cost").textContent = compactRinggit(metrics.effectiveCost);
  $("#admin-kpi-effective-note").textContent = `${metrics.costConfirmedCount}/${total || 0} confirmed cost records`;
  $("#admin-kpi-reduction").textContent = compactRinggit(metrics.challengeReduction);
  $("#admin-kpi-reduction-note").textContent = metrics.originalCost
    ? `${formatPercent(metrics.challengeReduction / metrics.originalCost * 100)} below original estimate`
    : "Original estimate not yet populated";
  $("#admin-kpi-priority").textContent = metrics.strategicPriority;
  $("#admin-kpi-risk").textContent = metrics.atRisk;
  $("#admin-kpi-hr").textContent = metrics.hrDependent;
  $("#admin-kpi-ict").textContent = metrics.ictDependent;
  $("#admin-kpi-users").textContent = adminProfiles.length;

  $("#admin-assurance-ownership").textContent = `${metrics.ownershipCompleteness}%`;
  $("#admin-assurance-evidence").textContent = `${metrics.evidenceAverage}%`;
  $("#admin-assurance-budget").textContent = `${metrics.approvedBudgetCoverage}%`;
  $("#admin-assurance-overdue").textContent = metrics.overdue;

  renderExecutiveNarrative(metrics);
  renderExecutiveAttention(metrics);
  renderExecutiveBudget(metrics);
  renderExecutiveReadiness(metrics);
  renderExecutiveComparison(metrics);
  renderExecutiveLists(metrics);
  renderAdminCharts(metrics);
  bindExecutiveRecordButtons();
}

function calculateExecutiveMetrics() {
  const today = new Date().toISOString().slice(0, 10);
  const total = adminProjects.length;
  const numeric = value => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const originalCost = adminProjects.reduce((sum, project) => sum + (numeric(project.estimated_cost) || 0), 0);
  const effectiveCost = adminProjects.reduce((sum, project) => sum + (numeric(project.estimated_cost_post_challenge) || 0), 0);
  const proposedBudget = adminProjects.reduce((sum, project) => sum + (numeric(project.proposed_budget_post_retreat) || 0), 0);
  const approvedBudget = adminProjects.reduce((sum, project) => sum + (numeric(project.approved_budget) || 0), 0);
  const costConfirmedCount = adminProjects.filter(project => numeric(project.estimated_cost_post_challenge) !== null).length;
  const proposedBudgetCount = adminProjects.filter(project => numeric(project.proposed_budget_post_retreat) !== null).length;
  const approvedBudgetCount = adminProjects.filter(project => numeric(project.approved_budget) !== null).length;
  const strategicPriority = adminProjects.filter(project =>
    ["Strategic Priority", "Corporate Priority"].includes(project.priority_status) ||
    project.priority === "Strategic"
  ).length;
  const watchlist = adminProjects.filter(project =>
    ["Watchlist / Under Review", "Not Assessed"].includes(project.priority_status)
  ).length;
  const atRisk = adminProjects.filter(project =>
    project.status === "At Risk" || ["High", "Extreme"].includes(project.risk_level)
  ).length;
  const hrDependent = adminProjects.filter(project =>
    ["Required", "To be confirmed"].includes(project.hr_collaboration_status)
  ).length;
  const ictDependent = adminProjects.filter(project =>
    (project.system_type && project.system_type !== "Non System") ||
    !["N/A", "None", null, undefined, ""].includes(project.ict_classification)
  ).length;
  const overdue = adminProjects.filter(project =>
    project.target_date && project.target_date < today && project.status !== "Completed"
  ).length;
  const departments = [...new Set(adminProjects.map(project => project.department).filter(Boolean))];

  const readinessScores = adminProjects.map(project => calculateProjectReadiness(project));
  const strategicReadiness = total
    ? Math.round(readinessScores.reduce((sum, item) => sum + item.score, 0) / total)
    : 0;
  const fullyReady = readinessScores.filter(item => item.checksMet === item.totalChecks).length;
  const followUp = total - fullyReady;

  const ownershipComplete = adminProjects.filter(project =>
    project.executive_sponsor && project.accountable_owner && project.delivery_lead
  ).length;
  const ownershipCompleteness = total ? Math.round(ownershipComplete / total * 100) : 0;
  const evidenceAverage = total
    ? Math.round(adminProjects.reduce((sum, project) => sum + Number(project.evidence_completeness || 0), 0) / total)
    : 0;
  const approvedBudgetCoverage = total ? Math.round(approvedBudgetCount / total * 100) : 0;

  const critical = adminProjects.filter(project =>
    ["Extreme"].includes(project.risk_level) ||
    project.status === "At Risk" ||
    (project.target_date && project.target_date < today && project.status !== "Completed") ||
    !project.accountable_owner
  );
  const watch = adminProjects.filter(project => {
    if (critical.includes(project)) return false;
    return ["High"].includes(project.risk_level) ||
      Number(project.readiness_score || 0) < 70 ||
      Number(project.evidence_completeness || 0) < 70 ||
      project.ict_classification === "New - Pending ICT review" ||
      ["Required", "To be confirmed"].includes(project.hr_collaboration_status) &&
        !["Supported", "Not required"].includes(project.hr_review_status);
  });
  const stable = Math.max(0, total - critical.length - watch.length);

  const decisionCounts = {
    approvedBudget: adminProjects.filter(project => numeric(project.approved_budget) === null).length,
    ict: adminProjects.filter(project =>
      project.ict_classification === "New - Pending ICT review" ||
      ((project.system_type && project.system_type !== "Non System") && !project.ict_classification)
    ).length,
    hr: adminProjects.filter(project =>
      ["Required", "To be confirmed"].includes(project.hr_collaboration_status) &&
      !["Supported", "Not required"].includes(project.hr_review_status)
    ).length,
    evidence: adminProjects.filter(project => Number(project.evidence_completeness || 0) < 70).length,
    priority: adminProjects.filter(project =>
      ["Not Assessed", "Watchlist / Under Review"].includes(project.priority_status)
    ).length
  };

  return {
    total,
    originalCost,
    effectiveCost,
    proposedBudget,
    approvedBudget,
    challengeReduction: originalCost - effectiveCost,
    costConfirmedCount,
    proposedBudgetCount,
    approvedBudgetCount,
    strategicPriority,
    watchlist,
    atRisk,
    hrDependent,
    ictDependent,
    overdue,
    departments,
    strategicReadiness,
    fullyReady,
    followUp,
    ownershipCompleteness,
    evidenceAverage,
    approvedBudgetCoverage,
    critical,
    watch,
    stable,
    decisionCounts,
    readinessScores
  };
}

function calculateProjectReadiness(project) {
  const costKnown = project.estimated_cost_post_challenge !== null &&
    project.estimated_cost_post_challenge !== undefined &&
    project.estimated_cost_post_challenge !== "";
  const hasDatedPlan = Boolean(project.start_date || project.target_date || extractProjectDateRange(project));
  const fit = deriveHome31Fit(project);
  const checks = [
    Boolean(project.project_description || project.problem_opportunity),
    hasDatedPlan,
    costKnown,
    Boolean(project.priority_status && project.priority_status !== "Not Assessed"),
    Boolean(project.ict_classification && project.ict_classification !== "New - Pending ICT review"),
    Boolean(project.strategic_pillar),
    fit !== "Needs Validation"
  ];
  const checksMet = checks.filter(Boolean).length;
  return {
    project,
    checksMet,
    totalChecks: checks.length,
    score: Math.round(checksMet / checks.length * 100)
  };
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

function renderExecutiveNarrative(metrics) {
  const topDepartment = departmentCostData()[0];
  const topPillar = pillarData("count")[0];
  const health = metrics.strategicReadiness >= 85 && metrics.atRisk <= Math.max(1, metrics.total * .1)
    ? "Healthy"
    : metrics.strategicReadiness >= 70
      ? "Watch"
      : "Intervention required";

  const badge = $("#admin-portfolio-health-badge");
  badge.textContent = health;
  badge.className = `executive-status-chip ${
    health === "Healthy" ? "good" : health === "Watch" ? "watch" : "critical"
  }`;

  const costStory = metrics.originalCost
    ? `The effective post-challenge cost is ${formatRinggit(metrics.effectiveCost)}, representing a ${formatRinggit(metrics.challengeReduction)} reduction from original estimates.`
    : `Cost information is still being established; ${metrics.costConfirmedCount} of ${metrics.total} records currently carry a confirmed post-challenge amount.`;

  $("#admin-executive-insight").textContent =
    `The HOME31 register currently contains ${metrics.total} initiatives across ${metrics.departments.length} departments, with strategic readiness of ${metrics.strategicReadiness}%. ${costStory} ` +
    `${topPillar ? `${topPillar.label} carries the largest initiative concentration` : "Strategic-pillar concentration is not yet available"}` +
    `${topDepartment ? `, while ${topDepartment.label} has the highest confirmed cost exposure.` : "."}`;

  $("#admin-insight-facts").innerHTML = `
    <article><strong>${metrics.strategicPriority} strategic-priority initiatives</strong><span>${metrics.watchlist} remain on watchlist or unassessed.</span></article>
    <article><strong>${metrics.ownershipCompleteness}% ownership completeness</strong><span>Executive sponsor, accountable owner and delivery lead.</span></article>
    <article><strong>${metrics.evidenceAverage}% evidence maturity</strong><span>Average evidence completeness across the portfolio.</span></article>
  `;
}

function renderExecutiveAttention(metrics) {
  $("#admin-attention-critical").textContent = metrics.critical.length;
  $("#admin-attention-watch").textContent = metrics.watch.length;
  $("#admin-attention-stable").textContent = metrics.stable;

  const rows = [
    ["Approved budget still blank", metrics.decisionCounts.approvedBudget],
    ["ICT review / classification pending", metrics.decisionCounts.ict],
    ["HR review or collaboration pending", metrics.decisionCounts.hr],
    ["Evidence completeness below 70%", metrics.decisionCounts.evidence],
    ["Priority decision outstanding", metrics.decisionCounts.priority]
  ];

  $("#admin-attention-summary").innerHTML = rows.map(([label, value]) => `
    <div class="attention-row"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>
  `).join("");
}

function renderExecutiveBudget(metrics) {
  $("#admin-budget-metrics").innerHTML = `
    <article><strong>${formatRinggit(metrics.challengeReduction)}</strong><span>Challenge movement versus original estimate</span></article>
    <article><strong>${metrics.proposedBudgetCount}/${metrics.total}</strong><span>Initiatives with proposed budget populated</span></article>
    <article><strong>${metrics.approvedBudgetCount}/${metrics.total}</strong><span>Initiatives with approved budget populated</span></article>
  `;

  const missingCost = metrics.total - metrics.costConfirmedCount;
  $("#admin-budget-footnote").textContent =
    `Only numeric post-challenge values are included in the effective total. ${missingCost} cost items remain blank or TBC. ` +
    `Proposed and approved budget totals remain understated until those source fields are populated.`;
}

function renderExecutiveReadiness(metrics) {
  $("#admin-readiness-gauge-value").textContent = `${metrics.strategicReadiness}%`;

  const departments = departmentReadinessData().slice(0, 10);
  $("#admin-department-readiness-bars").innerHTML = departments.map(item => `
    <div class="department-readiness-row" title="${escapeHtml(item.label)}: ${item.value}%">
      <span>${escapeHtml(item.label)}</span>
      <div class="department-readiness-track"><i style="width:${item.value}%"></i></div>
      <strong>${item.value}%</strong>
    </div>
  `).join("");

  $("#admin-readiness-footnote").innerHTML =
    `<strong>${metrics.fullyReady}</strong> initiatives meet all seven checks; <strong>${metrics.followUp}</strong> have at least one completeness follow-up. ` +
    `Budget approval coverage is shown separately because it is a downstream governance stage.`;
}

function renderExecutiveComparison(metrics) {
  const current = {
    portfolioItems: metrics.total,
    portfolioCost: metrics.effectiveCost,
    strategicPriority: metrics.strategicPriority,
    watchlist: metrics.watchlist,
    zeroBudgetOrConfirmedCost: adminProjects.filter(project =>
      Number(project.estimated_cost_post_challenge || 0) === 0
    ).length,
    departments: metrics.departments.length
  };

  const cards = [
    ["Portfolio items", "portfolioItems", value => String(value)],
    ["Portfolio cost basis", "portfolioCost", compactRinggit],
    ["Priority / corporate priority", "strategicPriority", value => String(value)],
    ["Watchlist / under review", "watchlist", value => String(value)],
    ["Zero budget / confirmed cost", "zeroBudgetOrConfirmedCost", value => String(value)],
    ["Departments represented", "departments", value => String(value)]
  ];

  $("#admin-comparison-grid").innerHTML = cards.map(([label, key, formatter]) => {
    const oldValue = AMP2026_BASELINE[key];
    const newValue = current[key];
    const delta = newValue - oldValue;
    const percentage = oldValue ? delta / oldValue * 100 : 0;
    return `
      <article class="comparison-card">
        <span>${escapeHtml(label)}</span>
        <div class="comparison-values">
          <div><span>AMP2026</span><strong>${formatter(oldValue)}</strong></div>
          <div><span>AMP2027</span><strong>${formatter(newValue)}</strong></div>
        </div>
        <div class="comparison-delta ${delta > 0 ? "negative" : ""}">
          ${delta >= 0 ? "+" : ""}${key === "portfolioCost" ? compactRinggit(delta) : delta.toLocaleString("en-MY")}
          (${delta >= 0 ? "+" : ""}${percentage.toFixed(1)}%)
        </div>
      </article>
    `;
  }).join("");

  $("#admin-comparison-notes").innerHTML = `
    <div class="comparison-note"><strong>AMP2027 reconciliation:</strong> ${formatRinggit(metrics.effectiveCost)} is the sum of numeric values in “Estimated Cost (Post Challenge)”. Blank or TBC items are excluded until confirmed.</div>
    <div class="comparison-note"><strong>Comparison basis:</strong> This is a management comparison, not a like-for-like accounting statement. AMP2026 is an approved-budget baseline; AMP2027 remains a post-challenge portfolio until proposed and approved budget fields are completed.</div>
  `;
}

function renderExecutiveLists(metrics) {
  const decisionItems = [
    {
      title: "Budget approval coverage",
      detail: `${metrics.decisionCounts.approvedBudget} initiatives require proposed or approved budget completion.`,
      count: metrics.decisionCounts.approvedBudget
    },
    {
      title: "ICT assessment",
      detail: `${metrics.decisionCounts.ict} initiatives require classification or architecture input.`,
      count: metrics.decisionCounts.ict
    },
    {
      title: "HR and workforce review",
      detail: `${metrics.decisionCounts.hr} initiatives require HR support, clarification or endorsement.`,
      count: metrics.decisionCounts.hr
    },
    {
      title: "Evidence closure",
      detail: `${metrics.decisionCounts.evidence} initiatives remain below 70% evidence completeness.`,
      count: metrics.decisionCounts.evidence
    },
    {
      title: "Priority determination",
      detail: `${metrics.decisionCounts.priority} initiatives remain unassessed or under review.`,
      count: metrics.decisionCounts.priority
    }
  ].filter(item => item.count > 0);

  $("#admin-decision-queue").innerHTML = decisionItems.length
    ? decisionItems.map(item => `
      <div class="executive-list-item">
        <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div>
        <em>${item.count}</em>
      </div>
    `).join("")
    : '<div class="executive-empty">No executive decision queue is currently outstanding.</div>';

  const topCost = adminProjects
    .slice()
    .sort((a, b) => effectiveProjectCost(b) - effectiveProjectCost(a))
    .filter(project => effectiveProjectCost(project) > 0)
    .slice(0, 5);

  $("#admin-top-cost-list").innerHTML = topCost.length
    ? topCost.map(project => `
      <div class="executive-list-item">
        <div><strong>${escapeHtml(project.initiative_name)}</strong><span>${escapeHtml(project.department || "No department")} · ${escapeHtml(project.priority_status || "Not assessed")}</span></div>
        <button data-executive-open="${project.id}" type="button">${compactRinggit(effectiveProjectCost(project))}</button>
      </div>
    `).join("")
    : '<div class="executive-empty">No confirmed cost records are available.</div>';

  const riskOrder = { Extreme: 4, High: 3, Medium: 2, Low: 1 };
  const topRisk = adminProjects
    .slice()
    .sort((a, b) =>
      (riskOrder[b.risk_level] || 0) - (riskOrder[a.risk_level] || 0) ||
      Number(a.readiness_score || 0) - Number(b.readiness_score || 0)
    )
    .slice(0, 5);

  $("#admin-top-risk-list").innerHTML = topRisk.length
    ? topRisk.map(project => `
      <div class="executive-list-item">
        <div><strong>${escapeHtml(project.initiative_name)}</strong><span>${escapeHtml(project.department || "No department")} · ${Number(project.readiness_score || 0)}% readiness</span></div>
        <button data-executive-open="${project.id}" type="button">${escapeHtml(project.risk_level || "Not rated")}</button>
      </div>
    `).join("")
    : '<div class="executive-empty">No risk records are available.</div>';
}

function bindExecutiveRecordButtons() {
  $$("[data-executive-open]").forEach(button =>
    button.addEventListener("click", () => openInitiativeModal(button.dataset.executiveOpen))
  );
}

function renderAdminCharts(metrics = calculateExecutiveMetrics()) {
  [
    "adminBudgetJourney",
    "adminReadinessGauge",
    "adminDeliveryLoad",
    "adminCostBenefit",
    "adminPillar",
    "adminHome31Fit",
    "adminDepartmentCost"
  ].forEach(key => charts[key]?.destroy());

  if (typeof Chart === "undefined") return;

  const common = executiveChartOptions();

  charts.adminBudgetJourney = new Chart($("#admin-budget-journey-chart"), {
    type: "bar",
    data: {
      labels: ["Original Estimate", "Effective Post-Challenge", "Proposed Budget", "Approved Budget"],
      datasets: [{
        data: [metrics.originalCost, metrics.effectiveCost, metrics.proposedBudget, metrics.approvedBudget],
        backgroundColor: [EXECUTIVE_COLORS.blue, EXECUTIVE_COLORS.gold, EXECUTIVE_COLORS.teal, EXECUTIVE_COLORS.green],
        borderRadius: 8,
        maxBarThickness: 88
      }]
    },
    options: {
      ...common,
      plugins: {
        ...common.plugins,
        legend: { display: false },
        tooltip: {
          callbacks: { label: context => formatRinggit(context.raw) }
        }
      },
      scales: executiveMoneyScales()
    }
  });

  charts.adminReadinessGauge = new Chart($("#admin-readiness-gauge-chart"), {
    type: "doughnut",
    data: {
      datasets: [{
        data: [metrics.strategicReadiness, Math.max(0, 100 - metrics.strategicReadiness)],
        backgroundColor: [EXECUTIVE_COLORS.teal, "#294a62"],
        borderWidth: 0,
        circumference: 230,
        rotation: 245,
        cutout: "78%"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });

  const delivery = quarterlyDeliveryData();
  charts.adminDeliveryLoad = new Chart($("#admin-delivery-load-chart"), {
    data: {
      labels: delivery.labels,
      datasets: [
        {
          type: "bar",
          label: "All Active",
          data: delivery.active,
          backgroundColor: "rgba(87,153,155,.85)",
          borderRadius: 5
        },
        {
          type: "line",
          label: "Strategic Priority",
          data: delivery.priority,
          borderColor: EXECUTIVE_COLORS.gold,
          backgroundColor: EXECUTIVE_COLORS.gold,
          pointBackgroundColor: "#f4f5f6",
          pointBorderColor: EXECUTIVE_COLORS.gold,
          pointRadius: 4,
          borderWidth: 2,
          tension: .25
        }
      ]
    },
    options: {
      ...common,
      scales: executiveCountScales()
    }
  });

  const matrixData = adminProjects.map(project => {
    const cost = effectiveProjectCost(project);
    const cba = Number(project.cba_ratio || 0);
    const complexity = project.ict_classification === "High" || project.people_impact_level === "Enterprise-wide"
      ? 22
      : project.ict_classification === "Medium" || project.people_impact_level === "High"
        ? 16
        : 10;
    return {
      x: cost,
      y: cba,
      r: complexity,
      project
    };
  });

  const priorityGroups = ["Strategic Priority", "Watchlist / Under Review", "Recommended", "Not Classified"];
  const priorityColors = {
    "Strategic Priority": "#5978c7",
    "Watchlist / Under Review": "#7fae71",
    "Recommended": EXECUTIVE_COLORS.gold,
    "Not Classified": EXECUTIVE_COLORS.red
  };

  charts.adminCostBenefit = new Chart($("#admin-cost-benefit-chart"), {
    type: "bubble",
    data: {
      datasets: priorityGroups.map(group => ({
        label: group,
        data: matrixData
          .filter(item => normalizePriorityGroup(item.project) === group)
          .map(item => ({ x: item.x, y: item.y, r: item.r, project: item.project })),
        backgroundColor: priorityColors[group] + "cc",
        borderColor: priorityColors[group],
        borderWidth: 1
      }))
    },
    options: {
      ...common,
      onClick: (_event, elements, chart) => {
        if (!elements.length) return;
        const point = chart.data.datasets[elements[0].datasetIndex].data[elements[0].index];
        if (point?.project?.id) openInitiativeModal(point.project.id);
      },
      plugins: {
        ...common.plugins,
        tooltip: {
          callbacks: {
            label: context => {
              const point = context.raw;
              const project = point.project;
              return [
                project.initiative_name,
                `Cost: ${formatRinggit(point.x)}`,
                `CBA: ${point.y || "Not recorded"}`,
                `ICT: ${project.ict_classification || "Not recorded"}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: EXECUTIVE_COLORS.grid },
          ticks: { color: EXECUTIVE_COLORS.text, callback: value => compactRinggit(value) },
          title: { display: true, text: "Effective post-challenge cost", color: EXECUTIVE_COLORS.text }
        },
        y: {
          beginAtZero: true,
          grid: { color: EXECUTIVE_COLORS.grid },
          ticks: { color: EXECUTIVE_COLORS.text },
          title: { display: true, text: "CBA ratio", color: EXECUTIVE_COLORS.text }
        }
      }
    }
  });

  renderExecutivePillarChart();

  const fitLabels = ["Enabler", "Supporting Activity", "Core Initiative", "Duplicate / Consolidate", "Needs Validation", "BAU · Supporting Enhancement", "Policy Review"];
  charts.adminHome31Fit = new Chart($("#admin-home31-fit-chart"), {
    type: "doughnut",
    data: {
      labels: fitLabels,
      datasets: [{
        data: fitLabels.map(label => adminProjects.filter(project => deriveHome31Fit(project) === label).length),
        backgroundColor: ["#d1ad63", "#7f99af", "#57999b", "#6f86a0", "#d9b769", "#a76a6f", "#8aa1b1"],
        borderColor: "#102f49",
        borderWidth: 4,
        cutout: "62%"
      }]
    },
    options: {
      ...common,
      plugins: {
        ...common.plugins,
        legend: {
          position: "bottom",
          labels: { color: EXECUTIVE_COLORS.text, usePointStyle: true, boxWidth: 9, padding: 12, font: { size: 9 } }
        }
      }
    }
  });

  const departmentCosts = departmentCostData().slice(0, 10);
  charts.adminDepartmentCost = new Chart($("#admin-department-cost-chart"), {
    type: "bar",
    data: {
      labels: departmentCosts.map(item => item.label),
      datasets: [
        {
          label: "AMP2026 Approved",
          data: departmentCosts.map(item => AMP2026_BASELINE.departmentApprovedBudget[item.label] || 0),
          backgroundColor: EXECUTIVE_COLORS.blue,
          borderRadius: 6
        },
        {
          label: "AMP2027 Effective",
          data: departmentCosts.map(item => item.value),
          backgroundColor: EXECUTIVE_COLORS.gold,
          borderRadius: 6
        }
      ]
    },
    options: {
      ...common,
      indexAxis: "y",
      onClick: (_event, elements) => {
        if (!elements.length) return;
        const department = departmentCosts[elements[0].index]?.label;
        if (!department) return;
        $("#admin-search").value = department;
        showModule("admin-portfolio");
        renderAdminPortfolio();
      },
      scales: executiveMoneyScales()
    }
  });

  const topDepartment = departmentCosts[0];
  $("#admin-cost-concentration-footnote").textContent = topDepartment
    ? `${topDepartment.label} carries ${formatRinggit(topDepartment.value)} (${metrics.effectiveCost ? (topDepartment.value / metrics.effectiveCost * 100).toFixed(1) : "0.0"}% of confirmed AMP2027 cost). Click an AMP2027 bar to open that department in the portfolio filter.`
    : "Department cost concentration will appear when confirmed post-challenge costs are recorded.";

  $("#admin-delivery-footnote").textContent =
    "Quarter load uses dates detected in the action plan, then start and target dates as fallback. Undated initiatives are excluded from the quarterly plot.";

  $("#admin-matrix-footnote").textContent =
    "Click a bubble to open the full initiative record. Zero-cost initiatives remain visible at the origin; tooltip details include ICT classification.";
}

function renderExecutivePillarChart() {
  charts.adminPillar?.destroy();
  if (typeof Chart === "undefined") return;

  const data = pillarData(pillarMetric);
  charts.adminPillar = new Chart($("#admin-pillar-chart"), {
    type: "bar",
    data: {
      labels: data.map(item => shortPillar(item.label)),
      datasets: [{
        label: pillarMetric === "count" ? "Initiatives" : "Effective cost",
        data: data.map(item => item.value),
        backgroundColor: EXECUTIVE_COLORS.gold,
        borderRadius: 7
      }]
    },
    options: {
      ...executiveChartOptions(),
      indexAxis: "y",
      onClick: (_event, elements) => {
        if (!elements.length) return;
        const pillar = data[elements[0].index]?.label;
        if (!pillar) return;
        $("#admin-pillar-filter").value = pillar;
        showModule("admin-portfolio");
        renderAdminPortfolio();
      },
      plugins: {
        ...executiveChartOptions().plugins,
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => pillarMetric === "cost"
              ? formatRinggit(context.raw)
              : `${context.raw} initiatives`
          }
        }
      },
      scales: pillarMetric === "cost" ? executiveMoneyScales() : executiveCountScales()
    }
  });
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
          font: { size: 9 }
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

function pillarData(metric = "count") {
  return pillars.map(pillar => {
    const records = adminProjects.filter(project => project.strategic_pillar === pillar);
    return {
      label: pillar,
      value: metric === "cost"
        ? records.reduce((sum, project) => sum + effectiveProjectCost(project), 0)
        : records.length
    };
  }).sort((a, b) => b.value - a.value);
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

function departmentCostData() {
  const map = new Map();
  adminProjects.forEach(project => {
    const department = project.department || "Not recorded";
    map.set(department, (map.get(department) || 0) + effectiveProjectCost(project));
  });
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function departmentReadinessData() {
  const map = new Map();
  adminProjects.forEach(project => {
    const department = project.department || "Not recorded";
    const current = map.get(department) || { total: 0, count: 0 };
    current.total += calculateProjectReadiness(project).score;
    current.count += 1;
    map.set(department, current);
  });
  return [...map.entries()]
    .map(([label, data]) => ({ label, value: Math.round(data.total / data.count) }))
    .sort((a, b) => a.value - b.value);
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

function quarterlyDeliveryData() {
  const ranges = adminProjects
    .map(project => ({ project, range: extractProjectDateRange(project) }))
    .filter(item => item.range);

  const currentYear = new Date().getFullYear();
  const minimumYear = ranges.length ? Math.min(...ranges.map(item => item.range.start.getFullYear())) : currentYear;
  const maximumYear = ranges.length ? Math.max(...ranges.map(item => item.range.end.getFullYear())) : currentYear + 2;
  const startYear = Math.max(currentYear - 1, minimumYear);
  const endYear = Math.min(startYear + 4, Math.max(startYear + 2, maximumYear));

  const quarters = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (let quarter = 1; quarter <= 4; quarter += 1) {
      const startMonth = (quarter - 1) * 3;
      const start = new Date(year, startMonth, 1);
      const end = new Date(year, startMonth + 3, 0, 23, 59, 59);
      quarters.push({ label: `${year} Q${quarter}`, start, end });
    }
  }

  return {
    labels: quarters.map(item => item.label),
    active: quarters.map(quarter =>
      ranges.filter(item => item.range.start <= quarter.end && item.range.end >= quarter.start).length
    ),
    priority: quarters.map(quarter =>
      ranges.filter(item =>
        item.range.start <= quarter.end &&
        item.range.end >= quarter.start &&
        normalizePriorityGroup(item.project) === "Strategic Priority"
      ).length
    )
  };
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
        <td>${escapeHtml(project.initiative_category || "Not recorded")}</td>
        <td>${escapeHtml(project.system_type || "Not recorded")}</td>
        <td>${escapeHtml(project.priority_status || "Not assessed")}</td>
        <td>${escapeHtml(project.strategic_pillar)}</td>
        <td><span class="status-pill">${escapeHtml(project.status)}</span></td>
        <td><span class="risk-pill">${escapeHtml(project.risk_level)}</span></td>
        <td>${formatRinggit(project.approved_budget)}</td>
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
  $("#initiative-year").value = "2027";
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
