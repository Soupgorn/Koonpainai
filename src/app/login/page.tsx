import { Login } from "@/components/account-screens";
import { isUiPreviewEnabled } from "@/lib/preview";
export default function Page() { return <Login previewEnabled={isUiPreviewEnabled()}/>; }
