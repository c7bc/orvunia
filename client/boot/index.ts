(() => {
  const view = new URLSearchParams(location.search).get("view");
  document.documentElement.dataset.view =
    view === "overlay" || view === "control" ? view : "panel";
})();
