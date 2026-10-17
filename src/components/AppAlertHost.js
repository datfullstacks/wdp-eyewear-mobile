import React from "react";
import CustomAlert from "./CustomAlert";
import { hideAppAlert, useAppAlertStore } from "../store/appAlertStore";

export default function AppAlertHost() {
  const visible = useAppAlertStore((s) => s.visible);
  const title = useAppAlertStore((s) => s.title);
  const message = useAppAlertStore((s) => s.message);
  const actions = useAppAlertStore((s) => s.actions);

  return (
    <CustomAlert
      visible={visible}
      title={title}
      message={message}
      actions={actions}
      onClose={hideAppAlert}
    />
  );
}
