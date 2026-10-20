import { isFictionalPreview } from "./auth/settings";
/** No production or partially-configured-auth bypass. Fictional UI requires an explicit dev opt-in. */
export const isUiPreviewEnabled = isFictionalPreview;
