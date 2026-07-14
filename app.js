import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// STEP 1: Replace these two values with your Supabase project details.
const SUPABASE_URL = "https://jmwduiivsxvtelpjncgr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5Fvivqq5KnxobZg1kGRxCg_cD9xF9CR";

const isConfigured =
  !SUPABASE_URL.includes("YOUR-PROJECT") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR-PUBLISHABLE-KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const elements = {
  configWarning: document.querySelector("#config-warning"),
  authSection: document.querySelector("#auth-section"),
  appSection: document.querySelector("#app-section"),
  userArea: document.querySelector("#user-area"),
  userEmail: document.querySelector("#user-email"),
  loginForm: document.querySelector("#login-form"),
  signupForm: document.querySelector("#signup-form"),
  logoutButton: document.querySelector("#logout-button"),
  projectForm: document.querySelector("#project-form"),
  projectId: document.querySelector("#project-id"),
  projectList: document.querySelector("#project-list"),
  projectMessage: document.querySelector("#project-message"),
  formTitle: document.querySelector("#form-title"),
  saveButton: document.querySelector("#save-button"),
  cancelEditButton: document.querySelector("#cancel-edit-button"),
  refreshButton: document.querySelector("#refresh-button"),
  toast: document.querySelector("#toast"),
  totalProjects: document.querySelector("#total-projects"),
  inProgressProjects: document.querySelector("#in-progress-projects"),
  completedProjects: document.querySelector("#completed-projects"),
  averageProgress: document.querySelector("#average-progress")
};

let currentUser = null;
let projects = [];

if (!isConfigured) {
  elements.configWarning.classList.remove("hidden");
}

elements.loginForm.addEventListener("submit", login);
elements.signupForm.addEventListener("submit", signup);
elements.logoutButton.addEventListener("click", logout);
elements.projectForm.addEventListener("submit", saveProject);
elements.cancelEditButton.addEventListener("click", resetProjectForm);
elements.refreshButton.addEventListener("click", loadProjects);

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  renderSession();
});

initialise();

async function initialise() {
  if (!isConfigured) return;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user ?? null;
  renderSession();
}

async function login(event) {
  event.preventDefault();
  if (!isConfigured) return showToast("Configure Supabase in app.js first.", true);

  const email = document.querySelector("#login-email").value.trim();
  const password = document.querySelector("#login-password").value;

  setFormBusy(elements.loginForm, true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setFormBusy(elements.loginForm, false);

  if (error) return showToast(error.message, true);
  elements.loginForm.reset();
  showToast("Signed in successfully.");
}

async function signup(event) {
  event.preventDefault();
  if (!isConfigured) return showToast("Configure Supabase in app.js first.", true);

  const email = document.querySelector("#signup-email").value.trim();
  const password = document.querySelector("#signup-password").value;

  setFormBusy(elements.signupForm, true);
  const { data, error } = await supabase.auth.signUp({ email, password });
  setFormBusy(elements.signupForm, false);

  if (error) return showToast(error.message, true);

  elements.signupForm.reset();
  if (data.session) {
    showToast("Account created and signed in.");
  } else {
    showToast("Account created. Check your email to confirm the account.");
  }
}

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) return showToast(error.message, true);
  showToast("You have logged out.");
}

function renderSession() {
  const signedIn = Boolean(currentUser);
  elements.authSection.classList.toggle("hidden", signedIn);
  elements.appSection.classList.toggle("hidden", !signedIn);
  elements.userArea.classList.toggle("hidden", !signedIn);

  if (signedIn) {
    elements.userEmail.textContent = currentUser.email ?? "Signed-in user";
    loadProjects();
  } else {
    projects = [];
    renderProjects();
    resetProjectForm();
  }
}

async function loadProjects() {
  if (!currentUser) return;

  showProjectMessage("Loading projects...");
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    showProjectMessage(error.message, true);
    return;
  }

  projects = data ?? [];
  hideProjectMessage();
  renderProjects();
  renderSummary();
}

async function saveProject(event) {
  event.preventDefault();
  if (!currentUser) return showToast("Please sign in.", true);

  const id = elements.projectId.value;
  const record = {
    project_name: value("#project-name"),
    strategic_pillar: value("#strategic-pillar"),
    department: value("#department"),
    project_owner: value("#project-owner"),
    status: value("#status"),
    progress: Number(value("#progress")),
    start_date: nullableValue("#start-date"),
    target_end_date: nullableValue("#target-end-date"),
    description: nullableValue("#description"),
    key_deliverables: nullableValue("#key-deliverables"),
    risks_issues: nullableValue("#risks-issues"),
    next_milestone: nullableValue("#next-milestone"),
    created_by: currentUser.id
  };

  if (record.progress < 0 || record.progress > 100) {
    return showToast("Progress must be between 0 and 100.", true);
  }

  elements.saveButton.disabled = true;
  elements.saveButton.textContent = id ? "Updating..." : "Saving...";

  let error;
  if (id) {
    ({ error } = await supabase
      .from("projects")
      .update(record)
      .eq("id", id));
  } else {
    ({ error } = await supabase
      .from("projects")
      .insert(record));
  }

  elements.saveButton.disabled = false;
  elements.saveButton.textContent = "Save project";

  if (error) return showToast(error.message, true);

  showToast(id ? "Project updated." : "Project saved.");
  resetProjectForm();
  await loadProjects();
}

function renderProjects() {
  if (!currentUser) {
    elements.projectList.innerHTML = "";
    return;
  }

  if (projects.length === 0) {
    elements.projectList.innerHTML =
      '<div class="notice">No projects yet. Use the form above to add your first project.</div>';
    return;
  }

  elements.projectList.innerHTML = projects.map(project => {
    const progress = clamp(Number(project.progress) || 0, 0, 100);
    return `
      <article class="project-card">
        <div class="project-card-head">
          <div>
            <h3>${escapeHtml(project.project_name)}</h3>
            <p class="meta">${escapeHtml(project.strategic_pillar)} · ${escapeHtml(project.department)}</p>
          </div>
          <span class="badge">${escapeHtml(project.status)}</span>
        </div>
        <p><strong>Owner:</strong> ${escapeHtml(project.project_owner)}</p>
        ${project.description ? `<p>${escapeHtml(project.description)}</p>` : ""}
        <div class="progress-row"><span>Progress</span><strong>${progress}%</strong></div>
        <div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div>
        <div class="card-actions">
          <button class="button secondary" data-action="edit" data-id="${project.id}" type="button">Edit</button>
          <button class="button danger" data-action="delete" data-id="${project.id}" type="button">Delete</button>
        </div>
      </article>
    `;
  }).join("");

  elements.projectList.querySelectorAll("[data-action='edit']")
    .forEach(button => button.addEventListener("click", () => editProject(button.dataset.id)));

  elements.projectList.querySelectorAll("[data-action='delete']")
    .forEach(button => button.addEventListener("click", () => deleteProject(button.dataset.id)));
}

function editProject(id) {
  const project = projects.find(item => String(item.id) === String(id));
  if (!project) return;

  elements.projectId.value = project.id;
  setValue("#project-name", project.project_name);
  setValue("#strategic-pillar", project.strategic_pillar);
  setValue("#department", project.department);
  setValue("#project-owner", project.project_owner);
  setValue("#status", project.status);
  setValue("#progress", project.progress);
  setValue("#start-date", project.start_date);
  setValue("#target-end-date", project.target_end_date);
  setValue("#description", project.description);
  setValue("#key-deliverables", project.key_deliverables);
  setValue("#risks-issues", project.risks_issues);
  setValue("#next-milestone", project.next_milestone);

  elements.formTitle.textContent = "Edit project";
  elements.cancelEditButton.classList.remove("hidden");
  elements.saveButton.textContent = "Update project";
  elements.projectForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteProject(id) {
  const project = projects.find(item => String(item.id) === String(id));
  if (!project) return;

  const confirmed = window.confirm(`Delete "${project.project_name}"?`);
  if (!confirmed) return;

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return showToast(error.message, true);

  showToast("Project deleted.");
  await loadProjects();
}

function resetProjectForm() {
  elements.projectForm.reset();
  elements.projectId.value = "";
  document.querySelector("#progress").value = "0";
  document.querySelector("#status").value = "Planning";
  elements.formTitle.textContent = "Add a project";
  elements.cancelEditButton.classList.add("hidden");
  elements.saveButton.textContent = "Save project";
}

function renderSummary() {
  const total = projects.length;
  const inProgress = projects.filter(p => p.status === "In Progress").length;
  const completed = projects.filter(p => p.status === "Completed").length;
  const average = total
    ? Math.round(projects.reduce((sum, p) => sum + Number(p.progress || 0), 0) / total)
    : 0;

  elements.totalProjects.textContent = total;
  elements.inProgressProjects.textContent = inProgress;
  elements.completedProjects.textContent = completed;
  elements.averageProgress.textContent = `${average}%`;
}

function showProjectMessage(message, isError = false) {
  elements.projectMessage.textContent = message;
  elements.projectMessage.classList.remove("hidden", "error");
  if (isError) elements.projectMessage.classList.add("error");
}

function hideProjectMessage() {
  elements.projectMessage.classList.add("hidden");
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.style.background = isError ? "#8f2525" : "#173a56";
  elements.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.add("hidden"), 4200);
}

function setFormBusy(form, busy) {
  form.querySelectorAll("button, input").forEach(element => element.disabled = busy);
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

function nullableValue(selector) {
  const result = value(selector);
  return result || null;
}

function setValue(selector, newValue) {
  document.querySelector(selector).value = newValue ?? "";
}

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function escapeHtml(valueToEscape) {
  return String(valueToEscape ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
