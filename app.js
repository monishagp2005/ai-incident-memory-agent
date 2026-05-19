const canvas = document.getElementById("neural-canvas");
const ctx = canvas.getContext("2d");
const particles = [];
const particleCount = 110;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function seedParticles() {
  particles.length = 0;
  for (let index = 0; index < particleCount; index += 1) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.42,
      vy: (Math.random() - 0.5) * 0.42,
      size: Math.random() * 1.8 + 0.7,
      hue: Math.random() > 0.55 ? 188 : 262,
    });
  }
}

function drawNetwork() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles.forEach((point, index) => {
    point.x += point.vx;
    point.y += point.vy;

    if (point.x < -20) point.x = window.innerWidth + 20;
    if (point.x > window.innerWidth + 20) point.x = -20;
    if (point.y < -20) point.y = window.innerHeight + 20;
    if (point.y > window.innerHeight + 20) point.y = -20;

    ctx.beginPath();
    ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${point.hue}, 100%, 72%, 0.72)`;
    ctx.shadowColor = `hsla(${point.hue}, 100%, 62%, 0.7)`;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    for (let next = index + 1; next < particles.length; next += 1) {
      const other = particles[next];
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 135) {
        const alpha = (1 - distance / 135) * 0.18;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(other.x, other.y);
        ctx.strokeStyle = `rgba(70, 246, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  });

  requestAnimationFrame(drawNetwork);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  seedParticles();
});

resizeCanvas();
seedParticles();
drawNetwork();

const memoryKey = "ai-incident-memory-agent.incidents";

const defaultIncidents = [
  {
    title: "Database overload caused by traffic spikes",
    similarity: 96,
    root: "Connection pool saturation after checkout campaign surge.",
    fix: "Auto scaling plus query optimization reduced P95 latency from 8.4s to 420ms.",
    team: "Payments Platform",
    timeline: "42 min",
    service: "payments",
    severity: "sev1",
  },
  {
    title: "Payment gateway timeout cascade",
    similarity: 91,
    root: "Gateway retries amplified dependency latency across checkout.",
    fix: "Shifted traffic to secondary region and tuned retry backoff.",
    team: "SRE Core",
    timeline: "31 min",
    service: "payments",
    severity: "sev2",
  },
  {
    title: "Checkout API worker pool exhaustion",
    similarity: 84,
    root: "Deployment increased synchronous calls to the pricing service.",
    fix: "Rolled back deployment and enabled async price cache refresh.",
    team: "Commerce Infra",
    timeline: "53 min",
    service: "checkout",
    severity: "sev2",
  },
];

function loadCustomIncidents() {
  try {
    const saved = JSON.parse(localStorage.getItem(memoryKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveCustomIncidents(items) {
  localStorage.setItem(memoryKey, JSON.stringify(items));
}

let customIncidents = loadCustomIncidents();

function allIncidents() {
  return [...customIncidents, ...defaultIncidents];
}

const alternativeIncidents = {
  "checkout latency spike": [
    {
      title: "Checkout latency spike after pricing deploy",
      similarity: 94,
      root: "Cache miss storm from invalidated pricing keys.",
      fix: "Warmed cache, capped recomputation, and rolled forward a patched cache key.",
      team: "Checkout",
      timeline: "26 min",
      service: "checkout",
      severity: "sev2",
    },
    ...defaultIncidents.slice(1),
  ],
  "database overload": defaultIncidents,
  "kafka consumer lag": [
    {
      title: "Kafka consumer lag delayed fulfillment events",
      similarity: 93,
      root: "New schema added high-cardinality enrichment with slow downstream writes.",
      fix: "Scaled consumers, paused enrichment, and replayed partitions with priority.",
      team: "Event Platform",
      timeline: "37 min",
      service: "events",
      severity: "sev1",
    },
    {
      title: "Notification pipeline backpressure",
      similarity: 88,
      root: "Dead-letter queue growth masked regional throttling.",
      fix: "Reduced batch size and moved notification writes to resilient queue workers.",
      team: "Messaging",
      timeline: "49 min",
      service: "events",
      severity: "sev3",
    },
    defaultIncidents[2],
  ],
};

const results = document.getElementById("incident-results");
const queryInput = document.getElementById("incident-query");
const thinking = document.getElementById("thinking");
const resultCount = document.getElementById("result-count");
const memoryDetail = document.getElementById("memory-detail");
const serviceFilter = document.getElementById("service-filter");
const severityFilter = document.getElementById("severity-filter");
let currentResults = allIncidents();
let selectedIncidentIndex = 0;
let activeSort = "similarity";
let lastPayload = allIncidents();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timelineMinutes(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function sortIncidents(items) {
  const sorted = [...items];
  if (activeSort === "timeline") {
    return sorted.sort((a, b) => timelineMinutes(a.timeline) - timelineMinutes(b.timeline));
  }
  if (activeSort === "custom") {
    return sorted.sort((a, b) => Number(b.source === "custom") - Number(a.source === "custom"));
  }
  return sorted.sort((a, b) => b.similarity - a.similarity);
}

function applyFilters(items) {
  return items.filter((incident) => {
    const serviceMatch = serviceFilter.value === "all" || incident.service === serviceFilter.value;
    const severityMatch = severityFilter.value === "all" || incident.severity === severityFilter.value;
    return serviceMatch && severityMatch;
  });
}

function renderIncidents(items) {
  currentResults = sortIncidents(applyFilters(items));
  selectedIncidentIndex = Math.min(selectedIncidentIndex, Math.max(currentResults.length - 1, 0));
  resultCount.textContent = `${currentResults.length} matches`;
  results.innerHTML = currentResults
    .map(
      (incident, index) => `
        <article class="incident-card ${incident.source === "custom" ? "custom-memory" : ""} ${index === selectedIncidentIndex ? "selected" : ""}" data-incident-index="${index}" tabindex="0" role="button">
          <div class="incident-top">
            <strong>${escapeHtml(incident.title)}</strong>
            <span class="badge">${incident.similarity}%</span>
          </div>
          <p><strong>Root cause:</strong> ${escapeHtml(incident.root)}</p>
          <p><strong>Resolved using:</strong> ${escapeHtml(incident.fix)}</p>
          <div class="meta-row">
            <span>${escapeHtml(incident.team)}</span>
            <span>${escapeHtml((incident.service || "platform").toUpperCase())}</span>
            <span>${escapeHtml((incident.severity || "sev2").toUpperCase())}</span>
            <span>Resolution timeline: ${escapeHtml(incident.timeline)}</span>
            ${incident.source === "custom" ? "<span>New memory</span>" : ""}
            <span>Confidence: high</span>
          </div>
        </article>
      `,
    )
    .join("");
  updateIncidentDetail();
  updateRiskBoard();
}

function riskProfile(incident) {
  const title = incident.title.toLowerCase();
  if (title.includes("kafka") || title.includes("pipeline") || title.includes("consumer")) {
    return {
      score: 82,
      risks: [
        ["Consumer lag and partition imbalance", 0.93],
        ["Downstream write throttling", 0.76],
        ["Schema enrichment regression", 0.68],
      ],
      action: "Scale consumers, pause enrichment, and replay priority partitions.",
    };
  }
  if (title.includes("gateway")) {
    return {
      score: 88,
      risks: [
        ["Gateway retry amplification", 0.9],
        ["Regional dependency degradation", 0.81],
        ["Checkout timeout budget exhaustion", 0.69],
      ],
      action: "Shift gateway traffic, reduce retries, and protect checkout timeout budget.",
    };
  }
  return {
    score: Math.min(96, Math.max(72, incident.similarity - 7)),
    risks: [
      ["Connection pool saturation", 0.91],
      ["Regional payment gateway degradation", 0.78],
      ["Recent checkout deploy regression", 0.64],
    ],
    action: "Increase pool size, route traffic to us-east-2, replay failed payments.",
  };
}

function updateRiskBoard() {
  const incident = currentResults[selectedIncidentIndex];
  if (!incident) return;
  const profile = riskProfile(incident);
  document.getElementById("risk-score").textContent = `Risk ${profile.score}`;
  ["a", "b", "c"].forEach((key, index) => {
    const [label, value] = profile.risks[index];
    document.getElementById(`risk-${key}-label`).textContent = label;
    document.getElementById(`risk-${key}-meter`).value = value;
    document.getElementById(`risk-${key}-value`).textContent = `${Math.round(value * 100)}%`;
  });
  document.getElementById("next-action").textContent = profile.action;
}

function updateIncidentDetail() {
  const incident = currentResults[selectedIncidentIndex];
  if (!incident) {
    memoryDetail.innerHTML = "";
    return;
  }
  memoryDetail.innerHTML = `
    <h3>${escapeHtml(incident.title)}</h3>
    <p><strong>AI memory trace:</strong> ${escapeHtml(incident.team)} resolved this ${escapeHtml((incident.severity || "sev2").toUpperCase())} ${escapeHtml(incident.service || "platform")} incident in ${escapeHtml(incident.timeline)} with ${incident.similarity}% semantic similarity.</p>
    <p><strong>Recommended operator move:</strong> ${escapeHtml(incident.fix)}</p>
  `;
}

function selectIncident(index) {
  selectedIncidentIndex = Number(index);
  renderIncidents(currentResults);
  const incident = currentResults[selectedIncidentIndex];
  if (incident) {
    addMessage("ai", `Memory selected: ${incident.title}. I updated root-cause risk, next action, and the incident detail panel.`);
  }
}

function analyzeIncident(value = queryInput.value) {
  const normalized = value.trim().toLowerCase();
  thinking.style.opacity = "1";
  results.style.opacity = "0.45";

  window.setTimeout(() => {
    const matchedKey = Object.keys(alternativeIncidents).find((key) => normalized.includes(key));
    const payload = matchedKey ? [...customIncidents, ...alternativeIncidents[matchedKey]] : allIncidents();
    lastPayload = payload;
    selectedIncidentIndex = 0;
    renderIncidents(payload);
    results.style.opacity = "1";
  }, 560);
}

document.getElementById("analyze-btn").addEventListener("click", () => analyzeIncident());

document.querySelectorAll(".suggestions button").forEach((button) => {
  button.addEventListener("click", () => {
    queryInput.value = button.textContent;
    analyzeIncident(button.textContent);
  });
});

renderIncidents(allIncidents());

[serviceFilter, severityFilter].forEach((filter) => {
  filter.addEventListener("change", () => {
    selectedIncidentIndex = 0;
    renderIncidents(lastPayload);
  });
});

results.addEventListener("click", (event) => {
  const card = event.target.closest("[data-incident-index]");
  if (!card) return;
  selectIncident(card.dataset.incidentIndex);
});

results.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-incident-index]");
  if (!card) return;
  event.preventDefault();
  selectIncident(card.dataset.incidentIndex);
});

document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    activeSort = button.dataset.sort;
    document.querySelectorAll("[data-sort]").forEach((item) => item.classList.toggle("active", item === button));
    selectedIncidentIndex = 0;
    renderIncidents(currentResults);
  });
});

document.getElementById("add-incident-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const title = document.getElementById("new-title").value.trim();
  const root = document.getElementById("new-root").value.trim();
  const fix = document.getElementById("new-fix").value.trim();
  const team = document.getElementById("new-team").value.trim();
  const timeline = document.getElementById("new-timeline").value.trim();
  const service = document.getElementById("new-service").value;
  const severity = document.getElementById("new-severity").value;
  const state = document.getElementById("memory-save-state");

  if (!title || !root || !fix || !team || !timeline) return;

  const incident = {
    title,
    similarity: Math.floor(89 + Math.random() * 9),
    root,
    fix,
    team,
    timeline,
    service,
    severity,
    source: "custom",
  };

  customIncidents = [incident, ...customIncidents].slice(0, 24);
  saveCustomIncidents(customIncidents);
  selectedIncidentIndex = 0;
  lastPayload = allIncidents();
  renderIncidents(allIncidents());
  queryInput.value = title;
  event.target.reset();
  document.getElementById("new-timeline").value = "45 min";
  state.textContent = `Memory committed: "${title}" is now available to the agent.`;
  window.setTimeout(() => {
    state.textContent = "";
  }, 5200);
});

const simulatorSignals = [
  {
    title: "Checkout latency anomaly detected",
    copy: "Trace spans show checkout waiting on payment-api while retry volume increases across two regions.",
    query: "payment gateway timeout cascade",
    risk: 74,
    blast: "18%",
    eta: "36m",
  },
  {
    title: "Database saturation trend emerging",
    copy: "Connection wait time and CPU steal are rising together after a traffic spike in the checkout funnel.",
    query: "database overload checkout latency spike",
    risk: 87,
    blast: "31%",
    eta: "18m",
  },
  {
    title: "Event backlog threatening fulfillment",
    copy: "Kafka lag is climbing while downstream writes slow, matching two prior fulfillment-delay incidents.",
    query: "kafka consumer lag fulfillment delay",
    risk: 81,
    blast: "24%",
    eta: "27m",
  },
];
let simulatorIndex = 0;

function runSimulation(signal = simulatorSignals[simulatorIndex]) {
  document.getElementById("live-signal-title").textContent = signal.title;
  document.getElementById("live-signal-copy").textContent = signal.copy;
  document.getElementById("sim-risk").textContent = signal.risk;
  document.getElementById("sim-blast").textContent = signal.blast;
  document.getElementById("sim-eta").textContent = signal.eta;
  queryInput.value = signal.query;
  analyzeIncident(signal.query);
  addMessage("ai", `Live signal ingested: ${signal.title}. I am matching historical incidents and generating recommended actions.`);
}

document.getElementById("simulate-btn").addEventListener("click", () => {
  simulatorIndex = (simulatorIndex + 1) % simulatorSignals.length;
  runSimulation(simulatorSignals[simulatorIndex]);
});

document.querySelectorAll("[data-sim]").forEach((button) => {
  button.addEventListener("click", () => {
    queryInput.value = button.dataset.sim;
    analyzeIncident(button.dataset.sim);
  });
});

document.getElementById("generate-plan").addEventListener("click", () => {
  const incident = currentResults[selectedIncidentIndex];
  if (!incident) {
    addMessage("ai", "No matching memory is visible under the current filters. Clear filters or run a broader search.");
    return;
  }

  const profile = riskProfile(incident);
  addMessage(
    "ai",
    `Investigation plan for ${incident.title}: 1. Confirm ${profile.risks[0][0]}. 2. Compare latest deploy markers with prior timeline. 3. Execute: ${profile.action} 4. Watch error budget, latency, and customer impact for 15 minutes.`,
  );
});

document.querySelectorAll("[data-count]").forEach((item) => {
  const target = Number(item.dataset.count);
  const suffix = target === 96 ? "%" : "";
  const duration = 1600 + Math.random() * 700;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(target * eased);
    item.textContent = `${current.toLocaleString()}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
});

const chatBody = document.getElementById("chat-body");
const chatInput = document.getElementById("chat-input");

function addMessage(className, text) {
  const node = document.createElement("div");
  node.className = `msg ${className}`;
  node.textContent = text;
  chatBody.appendChild(node);
  chatBody.scrollTop = chatBody.scrollHeight;
  return node;
}

function typeResponse(node, text) {
  let index = 0;
  node.textContent = "";
  const timer = window.setInterval(() => {
    node.textContent += text[index] || "";
    index += 1;
    if (index > text.length) window.clearInterval(timer);
  }, 18);
}

document.getElementById("chat-send").addEventListener("click", () => {
  const question = chatInput.value.trim();
  if (!question) return;
  addMessage("user", question);
  const response = addMessage("ai", "Thinking...");
  window.setTimeout(() => {
    typeResponse(
      response,
      "Incident commander summary: payment timeouts are likely caused by DB pool saturation plus gateway retry amplification. Recommended sequence: scale payment-api, raise pool limit, shift 25% traffic, replay failed payments, and notify Payments Platform.",
    );
  }, 450);
});

const timelineSteps = Array.from(document.querySelectorAll(".time-step"));
let timelineIndex = 0;
function activateTimelineStep(index) {
  timelineIndex = index;
  timelineSteps.forEach((step, index) => {
    step.classList.toggle("active", index === timelineIndex);
    step.style.borderColor = index <= timelineIndex ? "rgba(70, 246, 255, 0.58)" : "rgba(132, 229, 255, 0.18)";
    step.style.boxShadow = index === timelineIndex ? "0 0 34px rgba(70, 246, 255, 0.16)" : "none";
  });
}

window.setInterval(() => {
  activateTimelineStep(timelineIndex);
  timelineIndex = (timelineIndex + 1) % timelineSteps.length;
}, 1450);

timelineSteps.forEach((step, index) => {
  step.addEventListener("click", () => {
    activateTimelineStep(index);
    addMessage("ai", `Timeline focus: ${step.querySelector("strong").textContent} - ${step.querySelector("span").textContent}`);
  });
});

document.querySelectorAll("[data-graph]").forEach((node) => {
  node.addEventListener("click", () => {
    document.querySelectorAll("[data-graph]").forEach((item) => item.classList.toggle("active", item === node));
    document.getElementById("graph-insight").textContent = node.dataset.graph;
  });
});

document.querySelectorAll(".resolution-stack button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".resolution-stack button").forEach((item) => item.classList.remove("executed"));
    button.classList.add("executed");
    document.getElementById("action-status").textContent = `Autonomous action queued: ${button.textContent}. Confidence updated from current incident memory.`;
    addMessage("ai", `Queued action: ${button.textContent}. I will monitor blast radius, rollback safety, and recovery signals.`);
  });
});
