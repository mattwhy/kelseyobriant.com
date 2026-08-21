const site = document.getElementById("site");
if (!site) {
  console.warn("Portfolio root element not found; skipping client-side render.");
}

let panelElements = [];
const navHeartIcons = [
  "img/nav_heart_1.avif",
  "img/nav_heart_2.avif",
  "img/nav_heart_3.avif",
  "img/nav_heart_4.avif"
];
const clientLogoMap = {
  disney: "img/KELSEYSITE-logos_0000_DISNEY.png",
  arbys: "img/KELSEYSITE-logos_0001_ARBYS.png",
  venetian: "img/KELSEYSITE-logos_0002_VENETIAN.png",
  thevenetian: "img/KELSEYSITE-logos_0002_VENETIAN.png",
  cheerios: "img/KELSEYSITE-logos_0003_CHEERIOS.png",
  internationaldelight: "img/KELSEYSITE-logos_0004_ID.png",
  disneyxmakeawish: "img/KELSEYSITE-logos_0005_MAW_Disney_Cobrand.png",
  makeawishxdisney: "img/KELSEYSITE-logos_0005_MAW_Disney_Cobrand.png",
  massageenvy: "img/KELSEYSITE-logos_0006_MASSAGEENVY.png"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeContactHref(rawHref) {
  const href = String(rawHref || "").trim();
  if (!href) {
    return "";
  }

  if (href.startsWith("mailto:")) {
    return href;
  }

  try {
    const parsed = new URL(href);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch (_error) {
    return "";
  }

  return "";
}

function renderContactText(text) {
  const source = String(text || "");
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let cursor = 0;
  let output = "";
  let match;

  while ((match = pattern.exec(source)) !== null) {
    output += escapeHtml(source.slice(cursor, match.index));
    const label = escapeHtml(match[1]);
    const href = sanitizeContactHref(match[2]);

    if (!href) {
      output += escapeHtml(match[0]);
    } else if (href.startsWith("mailto:")) {
      output += `<a class="contact-link" href="${escapeHtml(href)}">${label}</a>`;
    } else {
      output += `<a class="contact-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">${label}</a>`;
    }

    cursor = pattern.lastIndex;
  }

  output += escapeHtml(source.slice(cursor));
  return output;
}

function normalizeUrlCandidate(input) {
  const text = String(input ?? "").trim();
  const iframeSrcMatch = text.match(/src=["']([^"']+)["']/i);
  const raw = iframeSrcMatch ? iframeSrcMatch[1] : text;
  return raw.replace(/&amp;/g, "&");
}

function buildYouTubeEmbedSrc(videoId) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    enablejsapi: "1"
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function extractEmbedSource(input) {
  if (!input) {
    return null;
  }

  const candidate = normalizeUrlCandidate(input);

  if (/^[a-zA-Z0-9_-]{11}$/.test(candidate)) {
    return { platform: "youtube", src: buildYouTubeEmbedSrc(candidate) };
  }

  if (/^\d+$/.test(candidate)) {
    return { platform: "vimeo", src: `https://player.vimeo.com/video/${candidate}` };
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const videoId = parsed.pathname.replace(/^\//, "").slice(0, 11);
      if (videoId) {
        return { platform: "youtube", src: buildYouTubeEmbedSrc(videoId) };
      }
    }

    if (host.includes("youtube.com")) {
      const watchId = parsed.searchParams.get("v");
      if (watchId) {
        return { platform: "youtube", src: buildYouTubeEmbedSrc(watchId.slice(0, 11)) };
      }

      const embedMatch = parsed.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) {
        return { platform: "youtube", src: buildYouTubeEmbedSrc(embedMatch[1]) };
      }
    }

    if (host.includes("vimeo.com")) {
      const playerMatch = parsed.pathname.match(/\/video\/(\d+)/);
      if (playerMatch) {
        return { platform: "vimeo", src: parsed.toString() };
      }

      const idMatch = parsed.pathname.match(/\/(\d+)(?:$|\/)/);
      if (idMatch) {
        return { platform: "vimeo", src: `https://player.vimeo.com/video/${idMatch[1]}` };
      }
    }
  } catch (_err) {
    return null;
  }

  return null;
}

function normalizeProjectVideos(project) {
  const explicitVideos = Array.isArray(project.videos) ? project.videos : [];
  const legacyVideos = [project.youtube, project.youtubeId, project.vimeo, project.video].filter(Boolean);
  const rawVideos = explicitVideos.length ? explicitVideos : legacyVideos;

  return rawVideos
    .map((item) => {
      if (typeof item === "string") {
        const embed = extractEmbedSource(item);
        if (!embed) {
          return null;
        }
        return {
          ...embed,
          label: "",
          aspectRatio: String(project.aspectRatio || "16 / 9")
        };
      }

      if (item && typeof item === "object") {
        const source = item.url || item.embed || item.src || "";
        const embed = extractEmbedSource(source);
        if (!embed) {
          return null;
        }
        return {
          ...embed,
          label: String(item.label || ""),
          aspectRatio: String(item.aspectRatio || project.aspectRatio || "16 / 9")
        };
      }

      return null;
    })
    .filter(Boolean);
}

function normalizeLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getProjectLogoSrc(client, title) {
  const clientKey = normalizeLookupKey(client);
  if (clientKey && clientLogoMap[clientKey]) {
    return clientLogoMap[clientKey];
  }

  const titleKey = normalizeLookupKey(title);
  if (titleKey && clientLogoMap[titleKey]) {
    return clientLogoMap[titleKey];
  }

  return "";
}

function pauseEmbeddedIframe(iframe) {
  if (!iframe || !iframe.contentWindow) {
    return;
  }

  const src = iframe.getAttribute("src") || "";
  if (src.includes("player.vimeo.com")) {
    iframe.contentWindow.postMessage({ method: "pause" }, "*");
    return;
  }

  if (src.includes("youtube.com/embed/")) {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      "*"
    );
  }
}

function pauseInactiveIframes(iframes, activeIndex) {
  iframes.forEach((iframe, index) => {
    if (index !== activeIndex) {
      pauseEmbeddedIframe(iframe);
    }
  });
}

function setupVideoCarousels() {
  const carousels = document.querySelectorAll(".video-carousel");

  carousels.forEach((carousel) => {
    const track = carousel.querySelector(".video-track");
    const prevButton = carousel.querySelector(".video-prev");
    const nextButton = carousel.querySelector(".video-next");
    const dots = Array.from(carousel.querySelectorAll(".video-dot"));
    if (!track || !nextButton || !prevButton) {
      return;
    }

    const slideCount = Number(carousel.getAttribute("data-count") || "1");
    let activeIndex = 0;

    const setArrowVisibility = (button, isVisible) => {
      button.disabled = !isVisible;
      button.classList.toggle("is-hidden", !isVisible);
      button.setAttribute("aria-hidden", isVisible ? "false" : "true");
    };

    const syncArrowVisibility = (index) => {
      setArrowVisibility(prevButton, index > 0);
      setArrowVisibility(nextButton, index < slideCount - 1);
    };

    const pauseNonActiveSlides = (targetIndex) => {
      const frames = Array.from(track.querySelectorAll(".video-slide iframe"));
      pauseInactiveIframes(frames, targetIndex);
    };

    const setActive = (index) => {
      const bounded = Math.max(0, Math.min(index, slideCount - 1));
      pauseNonActiveSlides(bounded);
      activeIndex = bounded;
      const slideWidth = track.clientWidth;
      track.scrollTo({ left: slideWidth * activeIndex, behavior: "smooth" });
      syncArrowVisibility(activeIndex);
      dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === activeIndex));
    };

    prevButton.addEventListener("click", () => {
      if (activeIndex <= 0) {
        return;
      }
      setActive(activeIndex - 1);
    });

    nextButton.addEventListener("click", () => {
      if (activeIndex >= slideCount - 1) {
        return;
      }
      setActive(activeIndex + 1);
    });

    track.addEventListener("scroll", () => {
      const slideWidth = track.clientWidth || 1;
      const index = Math.round(track.scrollLeft / slideWidth);
      if (index !== activeIndex) {
        activeIndex = index;
        pauseNonActiveSlides(activeIndex);
        syncArrowVisibility(activeIndex);
        dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === activeIndex));
      }
    });

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => setActive(index));
    });

    pauseNonActiveSlides(0);
    syncArrowVisibility(0);
  });
}

function setupProjectVideoAutoPause() {
  const projectPanels = document.querySelectorAll(".panel.project");
  if (!projectPanels.length) {
    return;
  }

  const pausePanelIframes = (panel) => {
    const iframes = panel.querySelectorAll("iframe");
    iframes.forEach((iframe) => pauseEmbeddedIframe(iframe));
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) {
          pausePanelIframes(entry.target);
        }
      });
    },
    {
      root: site,
      threshold: [0, 0.6, 1]
    }
  );

  projectPanels.forEach((panel) => observer.observe(panel));
}

async function loadPortfolioData() {
  const response = await fetch("projects.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load projects.json (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (!data || typeof data !== "object") {
    throw new Error("projects.json must contain a JSON object");
  }

  return {
    intro: data.intro || {},
    contact: data.contact || {},
    projects: Array.isArray(data.projects) ? data.projects : []
  };
}

function createIntroPanel(intro) {
  const section = document.createElement("section");
  section.className = "panel intro";
  section.id = "intro";

  const introImage = String(intro.image || "").trim();
  const introImageAlt = String(intro.imageAlt || `${intro.name || "Creative director"} portrait`).trim();
  if (introImage) {
    section.innerHTML = `
      <div class="panel-inner intro-shell intro-image-only">
        <figure class="intro-media"><img src="${escapeHtml(introImage)}" alt="${escapeHtml(introImageAlt)}" loading="eager" decoding="async" /></figure>
      </div>
      <p class="mobile-scroll-hint" aria-hidden="true"></p>
    `;
    return section;
  }

  const visualMarkup = `<div class="intro-placeholder" aria-hidden="true"><span>Image coming soon</span></div>`;

  section.innerHTML = `
    <div class="panel-inner intro-shell">
      <div class="intro-copy">
        <p class="kicker">${escapeHtml(intro.descriptor)}</p>
        <h1>${escapeHtml(intro.name)}</h1>
        <p class="lede">${escapeHtml(intro.bio)}</p>
      </div>
      <div class="intro-visual">
        ${visualMarkup}
      </div>
    </div>
    <p class="mobile-scroll-hint" aria-hidden="true"></p>
  `;
  return section;
}

function createProjectPanel(project, index) {
  const section = document.createElement("section");
  section.className = "panel project";
  section.setAttribute("aria-label", `Project ${index + 1}: ${project.title}`);
  if (index === 0) {
    section.id = "work";
  }

  const videos = normalizeProjectVideos(project);
  if (!videos.length) {
    return null;
  }

  const tags = (project.tags || "")
    .split("/")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const client = tags[0] || String(project.client || project.role || "").trim();
  const clientTagMarkup = client
    ? `<div class="tag-list project-client-tag"><span class="tag">${escapeHtml(client)}</span></div>`
    : "";
  const clientInlineMarkup = clientTagMarkup
    ? `<div class="project-client-tag-inline">${clientTagMarkup}</div>`
    : "";
  const clientFooterMarkup = clientTagMarkup
    ? `<div class="project-client-tag-footer">${clientTagMarkup}</div>`
    : "";
  const logoSrc = getProjectLogoSrc(client, project.title);
  const logoMarkup = logoSrc
    ? `<div class="project-logo-wrap"><img class="project-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(client || project.title)} logo" loading="lazy" decoding="async" /></div>`
    : "";

  const showCarouselControls = videos.length > 1;
  const madeWith = Array.isArray(project.madeWith) ? project.madeWith : [];
  const broughtToLifeBy = Array.isArray(project.broughtToLifeBy) ? project.broughtToLifeBy : [];

  section.innerHTML = `
    <div class="panel-inner project-shell">
      <div class="video-wrap video-carousel" data-count="${videos.length}" style="--video-aspect-ratio: ${escapeHtml(videos[0].aspectRatio || "16 / 9")};">
        <div class="video-track">
          ${videos
            .map(
              (video, videoIndex) => `
                <figure class="video-slide">
                  <iframe
                    src="${escapeHtml(video.src)}"
                    title="${escapeHtml(project.title)}${video.label ? ` - ${escapeHtml(video.label)}` : ` - Video ${videoIndex + 1}` }"
                    loading="lazy"
                    referrerpolicy="origin-when-cross-origin"
                    allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                    allowfullscreen
                  ></iframe>
                </figure>
              `
            )
            .join("")}
        </div>
        ${
          showCarouselControls
            ? `<button class="video-prev" type="button" aria-label="Previous video">&#8249;</button>
               <button class="video-next" type="button" aria-label="Next video">&#8250;</button>
               <div class="video-dots" role="tablist" aria-label="Project videos">
                 ${videos
                   .map(
                     (_video, dotIndex) =>
                       `<button class="video-dot${dotIndex === 0 ? " active" : ""}" type="button" aria-label="Go to video ${dotIndex + 1}"></button>`
                   )
                   .join("")}
               </div>`
            : ""
        }
      </div>
      <aside class="meta">
        ${logoMarkup}
        <div class="project-heading">
          <h2>${escapeHtml(project.title)}</h2>
          ${clientInlineMarkup}
        </div>
        <p class="project-blurb">${escapeHtml(project.blurb)}</p>
        ${
          madeWith.length
            ? `<div class="credit-block"><p class="credit-label">Made With</p><p class="credit-text">${escapeHtml(madeWith.join(", "))}</p></div>`
            : ""
        }
        ${
          broughtToLifeBy.length
            ? `<div class="credit-block"><p class="credit-label">Brought To Life By</p><p class="credit-text">${escapeHtml(broughtToLifeBy.join(", "))}</p></div>`
            : ""
        }
        ${clientFooterMarkup}
      </aside>
    </div>
  `;

  return section;
}

function buildProjectIndicatorLabel(project, index) {
  const title = String(project.title || `Project ${index + 1}`).trim();
  const tags = String(project.tags || "")
    .split("/")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const client = String(project.client || tags[0] || "").trim();

  if (client && title) {
    return `${client} - ${title}`;
  }

  return title || `Project ${index + 1}`;
}

function createContactPanel(contact) {
  const section = document.createElement("section");
  section.className = "panel contact";
  section.id = "about";

  const heading = String(contact.heading || "I'm a Creative Director, formerly an Art Director, formerly a Child.").trim();
  const blurb = String(contact.blurb || "").trim();
  const details = String(contact.details || "").trim();
  const imageSrc = String(contact.image || "").trim();
  const imageAlt = String(contact.imageAlt || "About image").trim();
  const emailLabel = String(contact.emailLabel || "").trim();
  const emailRow = contact.email
    ? `<p class="contact-copy-line contact-email-label">${escapeHtml(emailLabel)}</p><p class="contact-copy-line contact-email"><a class="contact-link" href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></p>`
    : "";
  const visualMarkup = imageSrc
    ? `<figure class="contact-visual"><img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(imageAlt)}" loading="lazy" decoding="async" /></figure>`
    : "";

  section.innerHTML = `
    <div class="panel-inner contact-shell">
      <div class="contact-layout">
        ${visualMarkup}
        <div class="contact-copy">
          <p class="contact-copy-line">${renderContactText(heading)}</p>
          ${blurb ? `<p class="contact-copy-line">${renderContactText(blurb)}</p>` : ""}
          ${details ? `<p class="contact-copy-line">${renderContactText(details)}</p>` : ""}
          ${emailRow}
        </div>
      </div>
    </div>
  `;

  return section;
}

function createScrollIndicator(panelLabels) {
  const indicator = document.createElement("aside");
  indicator.className = "scroll-indicator";

  const rail = document.createElement("div");
  rail.className = "scroll-indicator-rail";

  const dots = document.createElement("div");
  dots.className = "scroll-indicator-dots";
  for (let i = 0; i < panelLabels.length; i += 1) {
    const label = String(panelLabels[i] || `Section ${i + 1}`);
    const heartIcon = navHeartIcons[i % navHeartIcons.length];
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "scroll-indicator-dot";
    dot.setAttribute("data-panel-index", String(i));
    dot.setAttribute("data-label", label);
    dot.setAttribute("aria-label", `Go to ${label}`);
    dot.style.backgroundImage = `url("${heartIcon}")`;
    dots.appendChild(dot);
  }

  rail.append(dots);
  indicator.appendChild(rail);
  document.body.appendChild(indicator);
}

function updateIndicator(activeIndex) {
  const dots = document.querySelectorAll(".scroll-indicator-dot");
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === activeIndex);
    dot.setAttribute("aria-current", index === activeIndex ? "true" : "false");
  });
}

function updateScrollHintVisibility(activeIndex) {
  const hasScrolled = document.body.classList.contains("has-scrolled");
  document.body.classList.toggle("show-scroll-hint", activeIndex === 0 && !hasScrolled);
}

function setupActivePanelTracking() {
  if (!panelElements.length) {
    return;
  }

  let rafId = null;
  let lastActiveIndex = -1;

  const syncActiveFromScroll = () => {
    rafId = null;
    const activeIndex = getNearestPanelIndex();
    if (activeIndex !== lastActiveIndex) {
      lastActiveIndex = activeIndex;
      updateIndicator(activeIndex);
      updateScrollHintVisibility(activeIndex);
    }
  };

  site.addEventListener(
    "scroll",
    () => {
      if (site.scrollTop > 24) {
        document.body.classList.add("has-scrolled");
        document.body.classList.remove("show-scroll-hint");
      }
      if (rafId) {
        return;
      }
      rafId = window.requestAnimationFrame(syncActiveFromScroll);
    },
    { passive: true }
  );

  site.addEventListener("resize", syncActiveFromScroll);
  updateIndicator(0);
  updateScrollHintVisibility(0);
}

function setupIndicatorNavigation() {
  const dots = document.querySelectorAll(".scroll-indicator-dot");
  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = Number(dot.getAttribute("data-panel-index"));
      if (Number.isNaN(index) || !panelElements[index]) {
        return;
      }

      panelElements[index].scrollIntoView({ behavior: "smooth", block: "start" });
      updateIndicator(index);
    });
  });
}

function getNearestPanelIndex() {
  if (!panelElements.length) {
    return 0;
  }

  const viewportCenter = site.scrollTop + site.clientHeight / 2;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  panelElements.forEach((panel, index) => {
    const panelCenter = panel.offsetTop + panel.offsetHeight / 2;
    const distance = Math.abs(panelCenter - viewportCenter);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function setupWheelPaging() {
  if (!window.matchMedia("(pointer: fine)").matches) {
    return;
  }

  let wheelAccumulator = 0;
  let activeDirection = 0;
  let lastWheelTs = 0;
  let burstLock = false;
  let burstReleaseTimer = null;

  const resetBurstTimer = () => {
    if (burstReleaseTimer) {
      window.clearTimeout(burstReleaseTimer);
    }

    burstReleaseTimer = window.setTimeout(() => {
      burstLock = false;
      wheelAccumulator = 0;
      activeDirection = 0;
    }, 220);
  };

  site.addEventListener(
    "wheel",
    (event) => {
      if (!panelElements.length) {
        return;
      }

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      if (absY <= absX) {
        return;
      }

      event.preventDefault();

      const now = window.performance.now();
      if (now - lastWheelTs > 140) {
        wheelAccumulator = 0;
        activeDirection = 0;
        burstLock = false;
      }
      lastWheelTs = now;

      if (burstLock) {
        resetBurstTimer();
        return;
      }

      const direction = event.deltaY > 0 ? 1 : -1;
      if (activeDirection !== 0 && direction !== activeDirection) {
        wheelAccumulator = 0;
      }
      activeDirection = direction;

      wheelAccumulator += Math.abs(event.deltaY);
      if (wheelAccumulator < 60) {
        return;
      }

      wheelAccumulator = 0;

      const activeIndex = getNearestPanelIndex();
      const targetIndex = Math.max(0, Math.min(activeIndex + direction, panelElements.length - 1));
      if (targetIndex === activeIndex) {
        return;
      }

      panelElements[targetIndex].scrollIntoView({ behavior: "smooth", block: "start" });
      updateIndicator(targetIndex);

      burstLock = true;
      resetBurstTimer();
    },
    { passive: false }
  );
}

function setupKeyboardPaging() {
  if (!panelElements.length) {
    return;
  }

  let keyLock = false;

  const isEditableTarget = (element) => {
    if (!element) {
      return false;
    }

    const tag = String(element.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      return true;
    }

    if (element.isContentEditable) {
      return true;
    }

    return false;
  };

  const moveByDirection = (direction) => {
    const activeIndex = getNearestPanelIndex();
    const targetIndex = Math.max(0, Math.min(activeIndex + direction, panelElements.length - 1));
    if (targetIndex === activeIndex) {
      return;
    }

    panelElements[targetIndex].scrollIntoView({ behavior: "smooth", block: "start" });
    updateIndicator(targetIndex);
  };

  document.addEventListener("keydown", (event) => {
    if (!panelElements.length) {
      return;
    }

    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    let direction = 0;
    if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
      direction = 1;
    } else if (event.key === "ArrowUp" || event.key === "PageUp") {
      direction = -1;
    }

    if (direction === 0) {
      return;
    }

    event.preventDefault();
    if (keyLock) {
      return;
    }

    keyLock = true;
    moveByDirection(direction);

    window.setTimeout(() => {
      keyLock = false;
    }, 260);
  });
}

async function render() {
  if (!site) {
    return;
  }

  let data;
  try {
    data = await loadPortfolioData();
  } catch (error) {
    console.error(error);
    return;
  }

  panelElements = [];
  const fallbackSummary = site.querySelector(".seo-fallback");
  if (fallbackSummary) {
    fallbackSummary.remove();
  }
  site.innerHTML = "";
  const panelLabels = [];

  const introPanel = createIntroPanel(data.intro);
  panelElements.push(introPanel);
  panelLabels.push(String(data.intro?.name || "Intro"));
  site.appendChild(introPanel);

  data.projects.forEach((project, index) => {
    const panel = createProjectPanel(project, index);
    if (panel) {
      panelElements.push(panel);
      panelLabels.push(buildProjectIndicatorLabel(project, index));
      site.appendChild(panel);
    }
  });

  const contactPanel = createContactPanel(data.contact);
  panelElements.push(contactPanel);
  panelLabels.push("About");
  site.appendChild(contactPanel);

  createScrollIndicator(panelLabels);
  setupActivePanelTracking();
  setupIndicatorNavigation();
  setupVideoCarousels();
  setupProjectVideoAutoPause();
  setupWheelPaging();
  setupKeyboardPaging();
}

render();
