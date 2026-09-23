const isActiveTarget =
      (state.mode === "draw" && state.layerId === layer.id) ||
      (state.mode === "drag" && state.layerId === layer.id);
