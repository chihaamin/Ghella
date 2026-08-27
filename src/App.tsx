import { PhoneShell } from "@/components/ghella/phone-shell"
import { PrototypePanel } from "@/components/ghella/prototype-panel"

/**
 * The artboard: the app in its device frame, with the reviewer's control rig
 * beside it. Drop `<PrototypePanel />` to ship the app on its own.
 */
export default function App() {
  return (
    <div className="flex flex-wrap items-start justify-center gap-8 px-6 pt-9 pb-15">
      <div className="flex-none">
        <PhoneShell />
      </div>
      <PrototypePanel />
    </div>
  )
}
