import { createContext } from "react";

type ClientLayoutContextValue = {
  openNotificationModal: () => void;
};

const ClientLayoutContext = createContext<ClientLayoutContextValue>({
  openNotificationModal: () => {},
});

export default ClientLayoutContext;
