document.addEventListener("DOMContentLoaded", () => {
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

  // 1. LOG IN
  async function handleLogIn() {
    const emailUsername = document.getElementById("email-username").value.trim();
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
      showNotification('Server connection error. Make sure "node server.js" is running.', "error");
    }
  }


  async function handleSignUp() {
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const location = document.getElementById("location") ? document.getElementById("location").value.trim() : "";
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirm-password").value.trim();

    if (!username || !email || !password || !confirmPassword) {
      showNotification("Please complete all required fields.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showNotification("Passwords do not match.", "error");
      return;
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
    if (!strongPasswordRegex.test(password)) {
      showNotification(
        "Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character.",
        "error"
      );
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, location, password, confirmPassword }),
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

  // 3. FORGOT PASSWORD
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
  const existingBox = document.querySelector(".form-notification");
  if (existingBox) existingBox.remove();

  const icons = {
    success: "✔",
    error: "✖",
    warning: "⚠",
    info: "ℹ"
  };

  const notification = document.createElement("div");
  notification.className = `form-notification notification-${type}`;

  notification.innerHTML = `
    <div class="notif-content">
      <span class="notif-icon">${icons[type] || icons.error}</span>
      <span class="notif-message">${message}</span>
    </div>
    <button type="button" class="notif-close" aria-label="Close">&times;</button>
  `;

  const form = document.querySelector(".login-form");
  if (form) {
    form.parentNode.insertBefore(notification, form);
  } else {
    document.body.insertBefore(notification, document.body.firstChild);
  }


  const closeBtn = notification.querySelector(".notif-close");
  closeBtn.addEventListener("click", () => notification.remove());


  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

  const googleBtn = document.getElementById("btn-google");
  const facebookBtn = document.getElementById("btn-facebook");

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      window.location.href = "/api/auth/google";
    });
  }

  if (facebookBtn) {
    facebookBtn.addEventListener("click", () => {
      window.location.href = "/api/auth/facebook";
    });
  }
  
});