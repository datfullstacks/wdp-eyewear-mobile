import { Alert } from "react-native";
import { create } from "zustand";

const DEFAULT_ACTIONS = [{ text: "OK" }];

let installed = false;
let originalAlert = null;

const normalizeActions = (buttons) => {
  if (!Array.isArray(buttons) || !buttons.length) {
    return DEFAULT_ACTIONS;
  }

  return buttons.map((button) => ({
    text: button?.text || "OK",
    onPress: typeof button?.onPress === "function" ? button.onPress : undefined,
    style: button?.style,
  }));
};

export const useAppAlertStore = create((set) => ({
  visible: false,
  title: "",
  message: "",
  actions: DEFAULT_ACTIONS,
  show: ({ title, message, buttons }) =>
    set({
      visible: true,
      title: title || "",
      message: message || "",
      actions: normalizeActions(buttons),
    }),
  hide: () =>
    set((state) => ({
      ...state,
      visible: false,
    })),
}));

export function showAppAlert(title, message, buttons) {
  useAppAlertStore.getState().show({ title, message, buttons });
}

export function hideAppAlert() {
  useAppAlertStore.getState().hide();
}

export function installAppAlert() {
  if (installed) return;

  originalAlert = originalAlert || Alert.alert.bind(Alert);
  Alert.alert = (title, message, buttons) => {
    showAppAlert(title, message, buttons);
  };
  installed = true;
}

export function uninstallAppAlert() {
  if (!installed || !originalAlert) return;
  Alert.alert = originalAlert;
  installed = false;
}
