import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Replace these two placeholders with your Supabase project settings.
const SUPABASE_URL = "https://jmwduiivsxvtelpjncgr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5Fvivqq5KnxobZg1kGRxCg_cD9xF9CR";

const configured =
  !SUPABASE_URL.includes("YOUR-PROJECT") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR-PUBLISHABLE-KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const READINESS_GROUPS = {
  strategy: [
    ["#check-strategy", "HOME31 alignment is explicit"],
    ["#check-owner", "Ownership and decision rights are confirmed"],
    ["#check-scope", "Scope, dependencies and success boundaries are defined"]
  ],
  value: [
    ["#check-value-case", "Business need and options are supported"],
    ["#check-kpi", "Baseline, target and benefits ownership are defined"],
    ["#check-budget", "Funding and total cost view are available"]
  ],
  control: [
    ["#check-risk", "Risk, compliance and policy review is completed"],
    ["#check-data", "Architecture, data, privacy, cyber and resilience impacts are reviewed"],
    ["#check-procurement", "Procurement and vendor implications are understood"]
  ],
  delivery: [
    ["#check-delivery", "Delivery plan, resources and milestones are credible"],
    ["#check-operations", "Operational readiness and handover are considered"],
    ["#check-change", "Stakeholder, communication and adoption plan is defined"]
  ],
  hr: [
    ["#check-hr-engaged", "HR is engaged at the appropriate stage"],
    ["#check-hr-impact", "People impact assessment is completed"],
    ["#check-hr-workforce", "Workforce and capacity plan is agreed"],
    ["#check-hr-skills", "Skills and training plan is prepared"],
    ["#check-hr-change", "Employee communication and adoption plan is prepared"]
  ]
};

const ALL_READINESS_SELECTORS = Object.values(READINESS_GROUPS)
  .flat()
  .map(([selector]) => selector);

const elements = {
  warning: $("#configuration-warning"),
  authSection: $("#auth-section"),
  application: $("#application"),
  userEmail: $("#user-email"),
  logoutButton: $("#logout-button"),
  nav: $(".nav"),
  menuButton: $("#menu-button"),
  loginForm: $("#login-form"),
  signupForm: $("#signup-form"),
  projectForm: $("#project-form"),
  projectId: $("#project-id"),
  readinessScore: $("#readiness-score"),
  readinessBar: $("#readiness-bar"),
  readinessRecommendation: $("#readiness-recommendation"),
  readinessAdvice: $("#readiness-advice"),
  readinessGaps: $("#readiness-gaps"),
  hrPanel: $("#hr-collaboration-panel"),
  reviewSummary: $("#review-summary"),
  submitButton: $("#submit-project-button"),
  portfolioList: $("#portfolio-list"),
  portfolioMessage: $("#portfolio-message"),
  toast: $("#toast"),
  journeyBar: $("#journey-bar"),
  journeyLabel: $("#journey-label"),
  journeyPercent: $("#journey-percent")
};

let currentUser = null;
let currentStep = 1;
let projects = [];

if (!configured) elements.warning.classList.remove("hidden");

initialise();

async function initialise() {
  registerEvents();
  updateHrVisibility();
  calculateReadiness();

  if (!configured) return;

  const { data, error } = await supabase.auth.getSession();
  if (error) showToast(error.message, true);

  currentUser = data.session?.user ?? null;
  renderSession();
}

function registerEvents() {
  elements.loginForm.addEventListener("submit", signIn);
  elements.signupForm.addEventListener("submit", signUp);
  elements.logoutButton.addEventListener("click", signOut);
  elements.menuButton.addEventListener("click", () => elements.nav.classList.toggle("open"));

  $$("[data-scroll]").forEach(button => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.scroll);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      elements.nav.classList.remove("open");
    });
  });

  $$(".step-link").forEach(button => {
    button.addEventListener("click", () => showStep(Number(button.dataset.step)));
  });

  $$(".back-button").forEach(button => {
    button.addEventListener("click", () => showStep(Number(button.dataset.back)));
  });

  $("#start-button").addEventListener("click", startNewInitiative);
  $("#new-project-button").addEventListener("click", startNewInitiative);
  $("#demo-button").addEventListener("click", loadSample);
  $("#step-1-next").addEventListener("click", completeStepOne);
  $("#step-2-next").addEventListener("click", completeStepTwo);
  elements.submitButton.addEventListener("click", submitProject);
  $("#refresh-button").addEventListener("click", loadProjects);

  ALL_READINESS_SELECTORS.forEach(selector => {
    $(selector).addEventListener("change", calculateReadiness);
  });

  ["#risk-level", "#assessment-note"].forEach(selector => {
    $(selector).addEventListener("change", calculateReadiness);
  });

  $("#hr-collaboration-status").addEventListener("change", () => {
    updateHrVisibility();
    calculateReadiness();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    renderSession();
  });
}

async function signIn(event) {
  event.preventDefault();
  if (!configured) return showToast("Configure Supabase in app.js first.", true);

  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;

  setBusy(elements.loginForm, true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setBusy(elements.loginForm, false);

  if (error) return showToast(error.message, true);
  elements.loginForm.reset();
  showToast("Signed in successfully.");
}

async function signUp(event) {
  event.preventDefault();
  if (!configured) return showToast("Configure Supabase in app.js first.", true);

  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;

  setBusy(elements.signupForm, true);
  const { data, error } = await supabase.auth.signUp({ email, password });
  setBusy(elements.signupForm, false);

  if (error) return showToast(error.message, true);

  elements.signupForm.reset();
  showToast(data.session
    ? "Account created and signed in."
    : "Account created. Check your email to confirm it.");
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return showToast(error.message, true);
  showToast("Logged out.");
}

function renderSession() {
  const signedIn = Boolean(currentUser);

  elements.authSection.classList.toggle("hidden", signedIn);
  elements.application.classList.toggle("hidden", !signedIn);
  elements.logoutButton.classList.toggle("hidden", !signedIn);
  elements.userEmail.classList.toggle("hidden", !signedIn);

  if (signedIn) {
    elements.userEmail.textContent = currentUser.email ?? "Signed-in user";
    loadProjects();
  } else {
    projects = [];
    renderProjects();
    resetForm();
  }
}

function showStep(step) {
  currentStep = Math.max(1, Math.min(3, step));

  $$(".step-screen").forEach(screen => screen.classList.remove("active"));
  $$(".step-link").forEach(link => link.classList.remove("active"));

  $(`#step-${currentStep}`).classList.add("active");
  $(`.step-link[data-step="${currentStep}"]`).classList.add("active");

  for (let number = 1; number <= 3; number += 1) {
    const state = $(`#step-state-${number}`);
    if (number < currentStep) state.textContent = "Done";
    else if (number === currentStep) state.textContent = "Current";
    else state.textContent = "Pending";
  }

  const percentage = Math.round((currentStep / 3) * 100);
  elements.journeyBar.style.width = `${percentage}%`;
  elements.journeyLabel.textContent = `Step ${currentStep} of 3`;
  elements.journeyPercent.textContent = `${percentage}%`;

  $("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
}

function completeStepOne() {
  if (!elements.projectForm.reportValidity()) return;

  const progress = Number($("#progress").value);
  if (progress < 0 || progress > 100) {
    return showToast("Progress must be between 0 and 100.", true);
  }

  $("#check-strategy").checked = Boolean(value("#strategic-pillar") && value("#enterprise-outcome"));
  $("#check-owner").checked = Boolean(value("#accountable-owner") && value("#executive-sponsor"));
  $("#check-kpi").checked = Boolean(value("#value-target"));
  $("#check-scope").checked = Boolean(value("#problem-opportunity") && value("#next-action"));

  calculateReadiness();
  showStep(2);
}

function completeStepTwo() {
  const assessment = calculateReadiness();
  if (value("#hr-collaboration-status") === "Required" && !value("#hr-impact-summary")) {
    showToast("Please add a people and workforce impact summary, or select To be confirmed.", true);
    $("#hr-impact-summary").focus();
    return;
  }

  if (assessment.score < 55) {
    const proceed = window.confirm(
      `The readiness score is ${assessment.score}% (${assessment.recommendation}). Continue to review with the gaps recorded?`
    );
    if (!proceed) return;
  }

  buildReview();
  showStep(3);
}

function updateHrVisibility() {
  const status = value("#hr-collaboration-status");
  const applicable = status !== "Not required";
  elements.hrPanel.classList.toggle("hidden", !applicable);
  $("#score-hr-card").classList.toggle("hidden", !applicable);
}

function categoryScore(entries) {
  const completed = entries.filter(([selector]) => $(selector).checked).length;
  return Math.round((completed / entries.length) * 100);
}

function calculateReadiness() {
  const hrApplicable = value("#hr-collaboration-status") !== "Not required";
  const applicableGroups = [
    ...Object.values(READINESS_GROUPS).slice(0, 4),
    ...(hrApplicable ? [READINESS_GROUPS.hr] : [])
  ];
  const applicableChecks = applicableGroups.flat();
  const completed = applicableChecks.filter(([selector]) => $(selector).checked).length;
  const score = applicableChecks.length
    ? Math.round((completed / applicableChecks.length) * 100)
    : 0;

  const categoryScores = {
    strategy: categoryScore(READINESS_GROUPS.strategy),
    value: categoryScore(READINESS_GROUPS.value),
    control: categoryScore(READINESS_GROUPS.control),
    delivery: categoryScore(READINESS_GROUPS.delivery),
    hr: hrApplicable ? categoryScore(READINESS_GROUPS.hr) : null
  };

  $("#score-strategy").textContent = `${categoryScores.strategy}%`;
  $("#score-value").textContent = `${categoryScores.value}%`;
  $("#score-control").textContent = `${categoryScores.control}%`;
  $("#score-delivery").textContent = `${categoryScores.delivery}%`;
  $("#score-hr").textContent = `${categoryScores.hr ?? 0}%`;

  const risk = value("#risk-level");
  let recommendation;
  if (risk === "Extreme") recommendation = "Escalate";
  else if (score >= 85 && risk !== "High") recommendation = "Generally ready";
  else if (score >= 70) recommendation = "Proceed with conditions";
  else if (score >= 55) recommendation = "Rework gaps";
  else recommendation = "Not ready / defer";

  const gaps = applicableChecks
    .filter(([selector]) => !$(selector).checked)
    .map(([, label]) => label);

  if (hrApplicable && !value("#hr-representative")) gaps.push("Assign an HR representative or focal person");
  if (value("#hr-collaboration-status") === "Required" && !value("#hr-impact-summary")) {
    gaps.push("Document the people and workforce impact summary");
  }

  elements.readinessScore.textContent = `${score}%`;
  elements.readinessBar.style.width = `${score}%`;
  elements.readinessRecommendation.textContent = recommendation;

  const riskMessage = risk === "Extreme"
    ? "Extreme residual risk requires escalation regardless of the calculated score."
    : risk === "High"
      ? "High residual risk requires explicit treatment, ownership and authorised acceptance."
      : "Use the score together with evidence, residual risk and management judgement.";

  elements.readinessAdvice.innerHTML = `<strong>${escapeHtml(recommendation)}:</strong> ${escapeHtml(riskMessage)}`;
  elements.readinessGaps.innerHTML = gaps.length
    ? `<ul>${gaps.map(gap => `<li>${escapeHtml(gap)}</li>`).join("")}</ul>`
    : '<div class="notice blue"><strong>No material checklist gaps recorded.</strong> Confirm evidence remains current before the decision.</div>';

  return { score, recommendation, gaps, categoryScores };
}

function buildReview() {
  const assessment = calculateReadiness();
  const hrStatus = value("#hr-collaboration-status");
  const hrAreas = selectedHrAreas();

  const fields = [
    ["Initiative", value("#initiative-name")],
    ["Department", value("#department")],
    ["HOME31 pillar", value("#strategic-pillar")],
    ["Current phase", value("#current-phase")],
    ["Accountable owner", value("#accountable-owner")],
    ["Status", value("#status")],
    ["Progress", `${value("#progress")}%`],
    ["Risk level", value("#risk-level")],
    ["Readiness", `${assessment.score}% — ${assessment.recommendation}`],
    ["HR collaboration", hrStatus],
    ["Problem or opportunity", value("#problem-opportunity"), true],
    ["Expected outcome", value("#enterprise-outcome"), true],
    ["Value target", value("#value-target") || "Not specified", true],
    ["Next action", value("#next-action") || "Not specified", true],
    ["Readiness gaps", assessment.gaps.join("; ") || "No material checklist gaps recorded", true]
  ];

  if (hrStatus !== "Not required") {
    fields.push(
      ["HR engagement", `${value("#hr-engagement-stage")} — ${value("#hr-representative") || "Representative not assigned"}`, true],
      ["People impact", value("#hr-impact-summary") || "To be confirmed", true],
      ["HR collaboration areas", hrAreas.join(", ") || "To be confirmed", true]
    );
  }

  elements.reviewSummary.innerHTML = fields.map(([label, content, full]) => `
    <article class="review-card ${full ? "full" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(content)}</strong>
    </article>
  `).join("");
}

async function submitProject() {
  if (!currentUser) return showToast("Please sign in.", true);
  if (!elements.projectForm.reportValidity()) {
    showStep(1);
    return;
  }

  const id = elements.projectId.value;
  const record = collectRecord();

  elements.submitButton.disabled = true;
  elements.submitButton.textContent = id ? "Updating..." : "Saving...";

  let result;
  if (id) result = await supabase.from("projects").update(record).eq("id", id);
  else result = await supabase.from("projects").insert(record);

  elements.submitButton.disabled = false;
  elements.submitButton.textContent = "Save to Portfolio";

  if (result.error) return showToast(result.error.message, true);

  showToast(id ? "Initiative updated." : "Initiative saved to the portfolio.");
  resetForm();
  await loadProjects();
  $("#portfolio").scrollIntoView({ behavior: "smooth", block: "start" });
}

function collectRecord() {
  const assessment = calculateReadiness();
  return {
    initiative_name: value("#initiative-name"),
    department: value("#department"),
    strategic_pillar: value("#strategic-pillar"),
    executive_sponsor: nullableValue("#executive-sponsor"),
    accountable_owner: value("#accountable-owner"),
    delivery_lead: nullableValue("#delivery-lead"),
    status: value("#status"),
    current_phase: value("#current-phase"),
    progress: Number(value("#progress")),
    target_date: nullableValue("#target-date"),
    problem_opportunity: value("#problem-opportunity"),
    enterprise_outcome: value("#enterprise-outcome"),
    value_target: nullableValue("#value-target"),
    next_action: nullableValue("#next-action"),
    risk_level: value("#risk-level"),

    strategic_alignment_confirmed: $("#check-strategy").checked,
    ownership_confirmed: $("#check-owner").checked,
    scope_dependencies_defined: $("#check-scope").checked,
    value_case_prepared: $("#check-value-case").checked,
    kpi_defined: $("#check-kpi").checked,
    funding_view_available: $("#check-budget").checked,
    risk_compliance_reviewed: $("#check-risk").checked,
    data_cyber_architecture_reviewed: $("#check-data").checked,
    impact_reviewed: $("#check-data").checked,
    procurement_vendor_reviewed: $("#check-procurement").checked,
    delivery_plan_ready: $("#check-delivery").checked,
    operational_readiness_reviewed: $("#check-operations").checked,
    change_stakeholder_plan: $("#check-change").checked,

    hr_collaboration_status: value("#hr-collaboration-status"),
    hr_engagement_stage: nullableValue("#hr-engagement-stage"),
    hr_representative: nullableValue("#hr-representative"),
    hr_impact_summary: nullableValue("#hr-impact-summary"),
    hr_collaboration_areas: selectedHrAreas(),
    hr_engaged_early: $("#check-hr-engaged").checked,
    hr_people_impact_assessed: $("#check-hr-impact").checked,
    hr_workforce_plan: $("#check-hr-workforce").checked,
    hr_skills_training_plan: $("#check-hr-skills").checked,
    hr_change_comms_plan: $("#check-hr-change").checked,

    assessment_note: nullableValue("#assessment-note"),
    readiness_score: assessment.score,
    readiness_recommendation: assessment.recommendation,
    readiness_gaps: assessment.gaps,
    readiness_category_scores: assessment.categoryScores,
    created_by: currentUser.id
  };
}

function selectedHrAreas() {
  return $$("input[name='hr-area']:checked").map(input => input.value);
}

async function loadProjects() {
  if (!currentUser) return;

  showPortfolioMessage("Loading initiatives...");
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    showPortfolioMessage(error.message, true);
    return;
  }

  projects = data ?? [];
  hidePortfolioMessage();
  renderProjects();
  renderKpis();
}

function renderProjects() {
  if (!currentUser) {
    elements.portfolioList.innerHTML = "";
    return;
  }

  if (!projects.length) {
    elements.portfolioList.innerHTML =
      '<div class="notice blue">No initiatives have been submitted. Select “New Initiative” to create the first record.</div>';
    return;
  }

  elements.portfolioList.innerHTML = projects.map(project => {
    const progress = clamp(Number(project.progress) || 0, 0, 100);
    const hrRequired = project.hr_collaboration_status && project.hr_collaboration_status !== "Not required";
    return `
      <article class="project-card">
        <div class="project-card-head">
          <div>
            <h3>${escapeHtml(project.initiative_name)}${hrRequired ? '<span class="hr-tag">HR</span>' : ""}</h3>
            <p class="project-meta">
              ${escapeHtml(project.strategic_pillar)} · ${escapeHtml(project.department)} · ${escapeHtml(project.current_phase || "Phase not specified")}
            </p>
          </div>
          <span class="status-badge">${escapeHtml(project.status)}</span>
        </div>

        <p><strong>Owner:</strong> ${escapeHtml(project.accountable_owner)}</p>
        <p><strong>Outcome:</strong> ${escapeHtml(project.enterprise_outcome)}</p>
        <p><strong>Readiness:</strong> ${Number(project.readiness_score) || 0}% · ${escapeHtml(project.readiness_recommendation || "Not assessed")} · ${escapeHtml(project.risk_level)} risk</p>
        ${hrRequired ? `<p><strong>HR collaboration:</strong> ${escapeHtml(project.hr_collaboration_status)} · ${escapeHtml(project.hr_engagement_stage || "Stage not recorded")}</p>` : ""}

        <div class="progress-row">
          <span>Delivery progress</span>
          <strong>${progress}%</strong>
        </div>
        <div class="progress-track"><span style="width:${progress}%"></span></div>

        <div class="project-actions">
          <button class="button secondary small" type="button" data-edit="${project.id}">Edit</button>
          <button class="danger-button" type="button" data-delete="${project.id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");

  $$('[data-edit]').forEach(button => {
    button.addEventListener("click", () => editProject(button.dataset.edit));
  });
  $$('[data-delete]').forEach(button => {
    button.addEventListener("click", () => deleteProject(button.dataset.delete));
  });
}

function renderKpis() {
  const total = projects.length;
  const inProgress = projects.filter(project => project.status === "In Progress").length;
  const atRisk = projects.filter(project => ["High", "Extreme"].includes(project.risk_level)).length;
  const hrCount = projects.filter(project => project.hr_collaboration_status && project.hr_collaboration_status !== "Not required").length;
  const averageReadiness = total
    ? Math.round(projects.reduce((sum, project) => sum + Number(project.readiness_score || 0), 0) / total)
    : 0;

  $("#kpi-total").textContent = total;
  $("#kpi-progress").textContent = inProgress;
  $("#kpi-risk").textContent = atRisk;
  $("#kpi-average").textContent = `${averageReadiness}%`;
  $("#kpi-hr").textContent = hrCount;
}

function editProject(id) {
  const project = projects.find(item => String(item.id) === String(id));
  if (!project) return;

  setValue("#project-id", project.id);
  setValue("#initiative-name", project.initiative_name);
  setValue("#department", project.department);
  setValue("#strategic-pillar", project.strategic_pillar);
  setValue("#executive-sponsor", project.executive_sponsor);
  setValue("#accountable-owner", project.accountable_owner);
  setValue("#delivery-lead", project.delivery_lead);
  setValue("#status", project.status);
  setValue("#current-phase", project.current_phase || "Idea / Intake");
  setValue("#progress", project.progress);
  setValue("#target-date", project.target_date);
  setValue("#problem-opportunity", project.problem_opportunity);
  setValue("#enterprise-outcome", project.enterprise_outcome);
  setValue("#value-target", project.value_target);
  setValue("#next-action", project.next_action);
  setValue("#risk-level", project.risk_level || "Medium");

  setChecked("#check-strategy", project.strategic_alignment_confirmed);
  setChecked("#check-owner", project.ownership_confirmed);
  setChecked("#check-scope", project.scope_dependencies_defined);
  setChecked("#check-value-case", project.value_case_prepared);
  setChecked("#check-kpi", project.kpi_defined);
  setChecked("#check-budget", project.funding_view_available);
  setChecked("#check-risk", project.risk_compliance_reviewed);
  setChecked("#check-data", project.data_cyber_architecture_reviewed ?? project.impact_reviewed);
  setChecked("#check-procurement", project.procurement_vendor_reviewed);
  setChecked("#check-delivery", project.delivery_plan_ready);
  setChecked("#check-operations", project.operational_readiness_reviewed);
  setChecked("#check-change", project.change_stakeholder_plan);

  setValue("#hr-collaboration-status", project.hr_collaboration_status || "Not required");
  setValue("#hr-engagement-stage", project.hr_engagement_stage || "Not started");
  setValue("#hr-representative", project.hr_representative);
  setValue("#hr-impact-summary", project.hr_impact_summary);
  setChecked("#check-hr-engaged", project.hr_engaged_early);
  setChecked("#check-hr-impact", project.hr_people_impact_assessed);
  setChecked("#check-hr-workforce", project.hr_workforce_plan);
  setChecked("#check-hr-skills", project.hr_skills_training_plan);
  setChecked("#check-hr-change", project.hr_change_comms_plan);
  setValue("#assessment-note", project.assessment_note);

  const selectedAreas = new Set(project.hr_collaboration_areas || []);
  $$("input[name='hr-area']").forEach(input => {
    input.checked = selectedAreas.has(input.value);
  });

  updateHrVisibility();
  calculateReadiness();
  showStep(1);
  showToast("Initiative loaded for editing.");
}

async function deleteProject(id) {
  const project = projects.find(item => String(item.id) === String(id));
  if (!project) return;

  const confirmed = window.confirm(`Delete "${project.initiative_name}"?`);
  if (!confirmed) return;

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return showToast(error.message, true);

  showToast("Initiative deleted.");
  await loadProjects();
}

function startNewInitiative() {
  if (!currentUser) {
    $("#auth-section").scrollIntoView({ behavior: "smooth", block: "start" });
    return showToast("Sign in before creating an initiative.", true);
  }

  resetForm();
  showStep(1);
}

function resetForm() {
  elements.projectForm.reset();
  elements.projectId.value = "";
  $("#progress").value = "0";
  $("#status").value = "Planning";
  $("#current-phase").value = "Idea / Intake";
  $("#risk-level").value = "Medium";
  $("#hr-collaboration-status").value = "Not required";
  $("#hr-engagement-stage").value = "Not started";
  ALL_READINESS_SELECTORS.forEach(selector => { $(selector).checked = false; });
  $$("input[name='hr-area']").forEach(input => { input.checked = false; });
  $("#assessment-note").value = "";
  updateHrVisibility();
  calculateReadiness();
  buildReview();
  showStep(1);
}

function loadSample() {
  if (!currentUser) {
    $("#auth-section").scrollIntoView({ behavior: "smooth", block: "start" });
    return showToast("Sign in first, then load the sample.", true);
  }

  setValue("#initiative-name", "AI-Driven Document Verification");
  setValue("#department", "Corporate Planning & Strategy");
  setValue("#strategic-pillar", "Digital & Data Transformation");
  setValue("#executive-sponsor", "Executive Management Committee");
  setValue("#accountable-owner", "Head of Business Operations");
  setValue("#delivery-lead", "Programme Manager");
  setValue("#status", "Planning");
  setValue("#current-phase", "Business Case");
  setValue("#progress", "15");
  setValue("#problem-opportunity", "Manual document checking increases turnaround time, creates inconsistent verification outcomes and requires significant repetitive staff effort.");
  setValue("#enterprise-outcome", "Improve processing speed, control consistency, customer service reliability and employee capacity for higher-value work.");
  setValue("#value-target", "Reduce verification time from 2 working days to 4 hours and redeploy 20% of manual checking effort by December 2027.");
  setValue("#next-action", "Complete data, cyber, process and workforce impact assessments.");
  setValue("#risk-level", "Medium");

  ["#check-strategy", "#check-owner", "#check-scope", "#check-value-case", "#check-kpi", "#check-risk"]
    .forEach(selector => { $(selector).checked = true; });
  ["#check-budget", "#check-data", "#check-procurement", "#check-delivery", "#check-operations", "#check-change"]
    .forEach(selector => { $(selector).checked = false; });

  setValue("#hr-collaboration-status", "Required");
  setValue("#hr-engagement-stage", "Initial discussion");
  setValue("#hr-representative", "HR Business Partner");
  setValue("#hr-impact-summary", "The initiative may reduce repetitive verification tasks, change role profiles, require reskilling and support the redeployment of staff to exception handling and customer support.");
  ["#check-hr-engaged", "#check-hr-impact"].forEach(selector => { $(selector).checked = true; });
  ["#check-hr-workforce", "#check-hr-skills", "#check-hr-change"].forEach(selector => { $(selector).checked = false; });
  const demoAreas = new Set(["Role profiles & job descriptions", "Recruitment, redeployment or succession", "Skills, training & capability", "Change communication & engagement"]);
  $$("input[name='hr-area']").forEach(input => { input.checked = demoAreas.has(input.value); });
  setValue("#assessment-note", "Proceed to detailed assessment only after data, cyber, workforce capacity and change implications are confirmed.");

  updateHrVisibility();
  calculateReadiness();
  showStep(1);
  showToast("Comprehensive sample information loaded. Review it before saving.");
}

function showPortfolioMessage(message, error = false) {
  elements.portfolioMessage.textContent = message;
  elements.portfolioMessage.classList.remove("hidden", "error");
  if (error) elements.portfolioMessage.classList.add("error");
}

function hidePortfolioMessage() {
  elements.portfolioMessage.classList.add("hidden");
}

function showToast(message, error = false) {
  elements.toast.textContent = message;
  elements.toast.style.background = error ? "#8e1019" : "#1b1b1d";
  elements.toast.classList.remove("hidden");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 4200);
}

function setBusy(form, busy) {
  form.querySelectorAll("button, input").forEach(control => { control.disabled = busy; });
}

function value(selector) {
  return $(selector).value.trim();
}

function nullableValue(selector) {
  const result = value(selector);
  return result || null;
}

function setValue(selector, newValue) {
  $(selector).value = newValue ?? "";
}

function setChecked(selector, newValue) {
  $(selector).checked = Boolean(newValue);
}

function clamp(number, minimum, maximum) {
  return Math.min(Math.max(number, minimum), maximum);
}

function escapeHtml(valueToEscape) {
  return String(valueToEscape ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
