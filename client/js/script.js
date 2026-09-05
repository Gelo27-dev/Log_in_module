document.addEventListener("DOMContentLoaded", () => {
  const passwordInputs = document.querySelectorAll('input[type="password"]');

  passwordInputs.forEach((input) => {
    if (input.closest(".password-toggle-wrapper")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "password-toggle-wrapper";

    const parent = input.parentNode;
    parent.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "password-toggle";
    toggleButton.setAttribute("aria-label", "Show password");
    toggleButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zm11 3a3 3 0 110-6 3 3 0 010 6zm0-2a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
      </svg>
    `;

    toggleButton.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      toggleButton.classList.toggle("visible", isHidden);
      toggleButton.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password",
      );
    });

    wrapper.appendChild(toggleButton);
  });

  const passwordInput = document.getElementById("password");
  const passwordStrengthFill = document.getElementById(
    "password-strength-fill",
  );
  const passwordStrengthText = document.getElementById(
    "password-strength-text",
  );

  if (passwordInput && passwordStrengthFill && passwordStrengthText) {
    const getPasswordStrength = (value) => {
      const trimmedValue = value.trim();

      if (!trimmedValue) {
        return { score: 0, label: "Start typing", color: "#d93025" };
      }

      let score = 0;

      if (trimmedValue.length >= 8) score += 25;
      if (trimmedValue.length >= 12) score += 15;
      if (/[A-Z]/.test(trimmedValue)) score += 20;
      if (/[a-z]/.test(trimmedValue)) score += 20;
      if (/\d/.test(trimmedValue)) score += 10;
      if (/[^A-Za-z0-9]/.test(trimmedValue)) score += 10;

      if (score > 100) score = 100;

      let label = "Weak";
      let color = "#d93025";

      if (score >= 80) {
        label = "Strong";
        color = "#2d967f";
      } else if (score >= 55) {
        label = "Medium";
        color = "#f59e0b";
      }

      return { score, label, color };
    };

    const applyPasswordStrength = () => {
      const strengthWrapper = document.querySelector(
        ".password-strength-wrapper",
      );
      const { score, label, color } = getPasswordStrength(passwordInput.value);

      if (!passwordInput.value.trim()) {
        passwordStrengthFill.style.width = "0%";
        passwordStrengthText.textContent = "Start typing";
        passwordStrengthText.style.color = "#d93025";
        strengthWrapper?.classList.add("hidden-password-strength");
        passwordInput.classList.remove(
          "password-weak",
          "password-medium",
          "password-strong",
        );
        return;
      }

      strengthWrapper?.classList.remove("hidden-password-strength");
      passwordStrengthFill.style.width = `${Math.max(score, 0)}%`;
      passwordStrengthFill.style.background = color;
      passwordStrengthText.textContent = label;
      passwordStrengthText.style.color = color;

      passwordInput.classList.remove(
        "password-weak",
        "password-medium",
        "password-strong",
      );

      if (score >= 80) {
        passwordInput.classList.add("password-strong");
      } else if (score >= 55) {
        passwordInput.classList.add("password-medium");
      } else {
        passwordInput.classList.add("password-weak");
      }
    };

    passwordInput.addEventListener("input", applyPasswordStrength);
    applyPasswordStrength();
  }

  const form = document.querySelector(".login-form");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const isSignUp = document.getElementById("confirm-password");
      const isForgotPass = document.getElementById("reset-email");
      const isResetPass = document.getElementById("new-password");
      const isLogIn = document.getElementById("email-username");

      if (isSignUp) handleSignUp();
      else if (isForgotPass) handleForgotPassword();
      else if (isResetPass) handleResetPassword();
      else if (isLogIn) handleLogIn();
    });
  }

  async function handleLogIn() {
    const emailUsername = document
      .getElementById("email-username")
      .value.trim();
    const password = document.getElementById("password").value.trim();

    if (!emailUsername || !password) {
      showNotification("Please fill in both credentials.", "error");
      return;
    }

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailUsername, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.error, "error");
      } else {
        showNotification(data.message, "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1200);
      }
    } catch (err) {
      showNotification(
        'Server connection error. Make sure "node server.js" is running.',
        "error",
      );
    }
  }

  async function handleSignUp() {
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const location = document.getElementById("location")
      ? document.getElementById("location").value.trim()
      : "";
    const birthday = document.getElementById("birthday")
      ? document.getElementById("birthday").value.trim()
      : "";
    const phoneNumber = document.getElementById("phone")
      ? document.getElementById("phone").value.trim()
      : "";
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document
      .getElementById("confirm-password")
      .value.trim();

    if (
      !username ||
      !email ||
      !location ||
      !birthday ||
      !phoneNumber ||
      !password ||
      !confirmPassword
    ) {
      showNotification("Please complete all required fields.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showNotification("Passwords do not match.", "error");
      return;
    }

    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
    if (!strongPasswordRegex.test(password)) {
      showNotification(
        "Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character.",
        "error",
      );
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          location,
          birthday,
          phoneNumber,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.error, "error");
      } else {
        showNotification(data.message, "success");
        setTimeout(() => {
          window.location.href = "log_in.html";
        }, 1500);
      }
    } catch (err) {
      showNotification("Server connection error.", "error");
    }
  }

  async function handleForgotPassword() {
    const email = document.getElementById("reset-email").value.trim();

    if (!email) {
      showNotification("Please enter your email address.", "error");
      return;
    }

    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.error, "error");
      } else {
        showNotification(data.message, "success");
      }
    } catch (err) {
      showNotification("Server connection error.", "error");
    }
  }

  async function handleResetPassword() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const newPassword = document.getElementById("new-password").value.trim();

    if (!token) {
      showNotification("Invalid or missing reset token.", "error");
      return;
    }

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification(data.error, "error");
      } else {
        showNotification(data.message, "success");
        setTimeout(() => {
          window.location.href = "log_in.html";
        }, 1500);
      }
    } catch (err) {
      showNotification("Server connection error.", "error");
    }
  }

  function showNotification(message, type = "error") {
    const container = document.getElementById("notification-container");
    if (!container) return;

    const notification = document.createElement("div");
    notification.className = `notification notification-${type} notification-animate-in`;

    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };

    const titles = {
      success: "Success",
      error: "Error",
      warning: "Warning",
      info: "Information",
    };

    notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-icon notification-icon-${type}">
        ${icons[type]}
      </div>
      <div class="notification-body">
        <div class="notification-title">${titles[type]}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button type="button" class="notification-close" aria-label="Close notification">&times;</button>
    </div>
    <div class="notification-progress"></div>
  `;

    container.appendChild(notification);

    const closeBtn = notification.querySelector(".notification-close");
    const closeNotification = () => {
      notification.classList.remove("notification-animate-in");
      notification.classList.add("notification-animate-out");
      setTimeout(() => {
        notification.remove();
      }, 300);
    };

    closeBtn.addEventListener("click", closeNotification);

    setTimeout(() => {
      if (notification.parentNode) {
        closeNotification();
      }
    }, 5000);
  }

  async function checkSessionStatus() {
    try {
      const response = await fetch("/api/session");
      const data = await response.json();

      if (!data.loggedIn && data.message) {
        showNotification(data.message, "warning");
        setTimeout(() => {
          window.location.href = "log_in.html";
        }, 2000);
      }
    } catch (err) {
      console.error("Session check error:", err);
    }
  }

  setInterval(checkSessionStatus, 5 * 60 * 1000);

  fetch("/api/config")
    .then((res) => res.json())
    .then((config) => {
      const googleBtn = document.getElementById("btn-google");
      const facebookBtn = document.getElementById("btn-facebook");

      if (googleBtn && config.googleOAuthEnabled) {
        googleBtn.addEventListener("click", () => {
          window.location.href = "/api/auth/google";
        });
      } else if (googleBtn) {
        googleBtn.addEventListener("click", (event) => {
          event.preventDefault();
          showNotification("Google login is not configured yet.", "warning");
        });
      }

      if (facebookBtn && config.facebookOAuthEnabled) {
        facebookBtn.addEventListener("click", () => {
          window.location.href = "/api/auth/facebook";
        });
      } else if (facebookBtn) {
        facebookBtn.addEventListener("click", (event) => {
          event.preventDefault();
          showNotification(
            "Facebook login is not configured yet. Add FACEBOOK_APP_ID to .env.",
            "warning",
          );
        });
      }
    })
    .catch((err) => {
      console.log(
        "[WARNING] Could not load OAuth config. OAuth buttons will be hidden.",
        err,
      );
    });
});
