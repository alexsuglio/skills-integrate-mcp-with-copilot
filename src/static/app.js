document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authStatus = document.getElementById("auth-status");
  const userMenuButton = document.getElementById("user-menu-button");
  const loginModal = document.getElementById("login-modal");
  const closeLoginModal = document.getElementById("close-login-modal");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const authMessage = document.getElementById("auth-message");

  let authState = {
    authenticated: false,
    username: null,
  };

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function showAuthMessage(text, type = "info") {
    authMessage.textContent = text;
    authMessage.className = type;
    authMessage.classList.remove("hidden");
  }

  function hideAuthMessage() {
    authMessage.classList.add("hidden");
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
    hideAuthMessage();
  }

  function closeModal() {
    loginModal.classList.add("hidden");
    hideAuthMessage();
  }

  function updateAuthUI() {
    if (authState.authenticated) {
      authStatus.textContent = `Teacher mode: ${authState.username}`;
      logoutButton.classList.remove("hidden");
    } else {
      authStatus.textContent = "Viewing as Student";
      logoutButton.classList.add("hidden");
    }

    signupForm.classList.toggle("teacher-only-disabled", !authState.authenticated);

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.classList.toggle("hidden", !authState.authenticated);
    });
  }

  async function loadAuthStatus() {
    try {
      const response = await fetch("/auth/status");
      const status = await response.json();
      authState = {
        authenticated: Boolean(status.authenticated),
        username: status.username || null,
      };
      updateAuthUI();
    } catch (error) {
      authState = { authenticated: false, username: null };
      updateAuthUI();
      console.error("Error loading auth status:", error);
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn ${authState.authenticated ? "" : "hidden"}" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });

      updateAuthUI();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!authState.authenticated) {
      showMessage("Only logged-in teachers can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authState.authenticated) {
      showMessage("Only logged-in teachers can register students.", "error");
      openLoginModal();
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuButton.addEventListener("click", openLoginModal);
  closeLoginModal.addEventListener("click", closeModal);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeModal();
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showAuthMessage(result.detail || "Login failed", "error");
        return;
      }

      loginForm.reset();
      await loadAuthStatus();
      await fetchActivities();
      closeModal();
      showMessage(`Logged in as ${result.username}`, "success");
    } catch (error) {
      showAuthMessage("Failed to log in. Please try again.", "error");
      console.error("Login error:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", { method: "POST" });
      await loadAuthStatus();
      await fetchActivities();
      closeModal();
      showMessage("Logged out", "info");
    } catch (error) {
      showAuthMessage("Failed to log out. Please try again.", "error");
      console.error("Logout error:", error);
    }
  });

  // Initialize app
  loadAuthStatus().then(fetchActivities);
});
