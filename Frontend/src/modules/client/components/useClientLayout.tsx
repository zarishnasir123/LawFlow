import { useContext } from "react";
import ClientLayoutContext from "./ClientLayoutContext";

export default function useClientLayout() {
  return useContext(ClientLayoutContext);
}
