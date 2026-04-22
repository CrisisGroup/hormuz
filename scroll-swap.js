(function () {
  const swaps = Array.from(document.querySelectorAll("[data-scroll-swap]"));
  if (!swaps.length) return;

  const FADE_DURATION_MS = 360;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const preloadCache = new Set();

  function getSwapImage(swap) {
    return swap.querySelector(".scroll-swap__image--active");
  }

  function getBufferImage(swap) {
    return swap.querySelector(".scroll-swap__image--buffer");
  }

  function getSwapTrack(swap) {
    return swap.querySelector(".scroll-swap__track");
  }

  function preloadSource(src) {
    if (!src || preloadCache.has(src)) return;
    const preloader = new Image();
    preloader.src = src;
    preloadCache.add(src);
  }

  function getSwapSources(image) {
    const sources = image.dataset.swapSrcs
      ? image.dataset.swapSrcs.split(",").map((src) => src.trim()).filter(Boolean)
      : [];

    if (sources.length) return sources;

    return [image.dataset.beforeSrc, image.dataset.afterSrc].filter(Boolean);
  }

  function getInitialSwapIndex(swap, sources) {
    const requestedIndex = Number.parseInt(swap.dataset.swapIndex, 10);

    if (Number.isInteger(requestedIndex)) {
      return Math.min(Math.max(requestedIndex, 0), sources.length - 1);
    }

    if (swap.dataset.swapState === "after") {
      return Math.min(1, sources.length - 1);
    }

    return 0;
  }

  function applySwapImage(swap, nextIndex) {
    const activeImage = getSwapImage(swap);
    const bufferImage = getBufferImage(swap);
    if (!activeImage || !bufferImage) return;

    const sources = getSwapSources(activeImage);
    if (!sources.length) return;

    const clampedIndex = Math.min(Math.max(nextIndex, 0), sources.length - 1);
    const nextSrc = sources[clampedIndex];
    swap.dataset.swapIndex = String(clampedIndex);
    swap.dataset.swapState = clampedIndex === 0 ? "before" : "after";

    if (!nextSrc || activeImage.getAttribute("src") === nextSrc) return;

    if (prefersReducedMotion.matches) {
      window.clearTimeout(swap.__swapCleanupTimer);
      swap.__swapCleanupTimer = undefined;
      activeImage.setAttribute("src", nextSrc);
      bufferImage.setAttribute("src", nextSrc);
      bufferImage.classList.remove("is-visible");
      return;
    }

    window.clearTimeout(swap.__swapCleanupTimer);
    swap.__swapCleanupTimer = undefined;
    swap.__swapToken = (swap.__swapToken || 0) + 1;
    const swapToken = swap.__swapToken;

    function cleanup() {
      if (swap.__swapToken !== swapToken) return;
      bufferImage.classList.remove("is-visible");
      if (swap.__bufferLoadHandler === handleLoad) {
        bufferImage.removeEventListener("load", handleLoad);
        bufferImage.removeEventListener("error", handleLoad);
        swap.__bufferLoadHandler = undefined;
      }
      activeImage.setAttribute("src", nextSrc);
      bufferImage.setAttribute("src", nextSrc);
      swap.__swapCleanupTimer = undefined;
    }

    function handleLoad() {
      if (swap.__swapToken !== swapToken) return;
      requestAnimationFrame(() => {
        if (swap.__swapToken !== swapToken) return;
        bufferImage.classList.add("is-visible");
      });
      swap.__swapCleanupTimer = window.setTimeout(cleanup, FADE_DURATION_MS);
    }

    bufferImage.classList.remove("is-visible");
    if (swap.__bufferLoadHandler) {
      bufferImage.removeEventListener("load", swap.__bufferLoadHandler);
      bufferImage.removeEventListener("error", swap.__bufferLoadHandler);
    }
    swap.__bufferLoadHandler = handleLoad;
    bufferImage.addEventListener("load", handleLoad, { once: true });
    bufferImage.addEventListener("error", handleLoad, { once: true });
    bufferImage.setAttribute("src", nextSrc);

    if (bufferImage.complete) {
      handleLoad();
    }
  }

  swaps.forEach((swap) => {
    const image = getSwapImage(swap);
    if (!image) return;

    const sources = getSwapSources(image);
    sources.forEach(preloadSource);
    applySwapImage(swap, getInitialSwapIndex(swap, sources));
  });

  let ticking = false;

  function updateSwaps() {
    const triggerLine = window.innerHeight * 0.58;

    swaps.forEach((swap) => {
      const track = getSwapTrack(swap);
      if (!track) return;

      const image = getSwapImage(swap);
      if (!image) return;

      const sources = getSwapSources(image);
      if (!sources.length) return;

      const trackRect = track.getBoundingClientRect();
      const trackHeight = Math.max(trackRect.height, 1);
      const trackProgress = Math.min(Math.max((triggerLine - trackRect.top) / trackHeight, 0), 0.999);
      const nextIndex = trackRect.top <= triggerLine
        ? Math.min(Math.floor(trackProgress * (sources.length - 1)) + 1, sources.length - 1)
        : 0;

      if (Number.parseInt(swap.dataset.swapIndex, 10) !== nextIndex) {
        applySwapImage(swap, nextIndex);
      }
    });

    ticking = false;
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateSwaps);
  }

  requestUpdate();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
})();
