import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Material 3 device chrome, ported from the design project's
 * `android-frame.jsx` starter. Status bar + optional top app bar + content +
 * gesture nav, with an optional Gboard. No image assets.
 */
const MD = {
  surface: "#f4fbf8",
  surfaceVariant: "#dae5e1",
  inverseOnSurface: "#ecf2ef",
  secondaryContainer: "#cde8e1",
  primaryFixedDim: "#83d5c6",
  onSurface: "#171d1b",
  onSurfaceVar: "#49454f",
  onPrimaryContainer: "#00201c",
  primary: "#006a60",
  frameBorder: "rgba(116,119,117,0.5)",
} as const

export function AndroidStatusBar({ dark = false }: { dark?: boolean }) {
  const c = dark ? "#fff" : MD.onSurface
  return (
    <div className="relative flex h-10 items-center justify-between px-4 font-[Roboto,system-ui,sans-serif]">
      <div className="flex w-32 items-center gap-2">
        <span className="text-[14px] leading-5 tracking-[0.25px]" style={{ color: c }}>
          9:30
        </span>
      </div>

      {/* camera punch-hole */}
      <div className="absolute top-2 left-1/2 size-6 -translate-x-1/2 rounded-full bg-[#2e2e2e]" />

      <div className="flex items-center">
        <div className="flex pr-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" className="-mr-0.5">
            <path d="M8 13.3L.67 5.97a10.37 10.37 0 0114.66 0L8 13.3z" fill={c} />
          </svg>
          <svg width="16" height="16" viewBox="0 0 16 16" className="-mr-0.5">
            <path d="M14.67 14.67V1.33L1.33 14.67h13.34z" fill={c} />
          </svg>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect x="3.75" y="2" width="8.5" height="13" rx="1.5" fill={c} />
          <rect x="5.5" y="0.9" width="5" height="2" rx="0.5" fill={c} />
        </svg>
      </div>
    </div>
  )
}

function IconDot() {
  return (
    <div className="flex size-12 items-center justify-center">
      <div
        className="size-[22px] rounded-full opacity-30"
        style={{ background: MD.onSurfaceVar }}
      />
    </div>
  )
}

export function AndroidAppBar({
  title = "Title",
  large = false,
}: {
  title?: string
  large?: boolean
}) {
  return (
    <div className="px-1 pt-1" style={{ background: MD.surface }}>
      <div className="flex h-14 items-center gap-1">
        <IconDot />
        {large ? (
          <div className="flex-1" />
        ) : (
          <span
            className="flex-1 font-[Roboto,system-ui,sans-serif] text-[22px]"
            style={{ color: MD.onSurface }}
          >
            {title}
          </span>
        )}
        <IconDot />
      </div>
      {large && (
        <div
          className="px-4 pt-4 pb-5 font-[Roboto,system-ui,sans-serif] text-[28px]"
          style={{ color: MD.onSurface }}
        >
          {title}
        </div>
      )}
    </div>
  )
}

export function AndroidNavBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex h-6 items-center justify-center">
      <div
        className="h-1 w-[108px] rounded-sm opacity-40"
        style={{ background: dark ? "#fff" : MD.onSurface }}
      />
    </div>
  )
}

function Key({
  label,
  flex = 1,
  bg = MD.surface,
  radius = 6,
  minWidth,
  fontSize = 21,
}: {
  label: string
  flex?: number
  bg?: string
  radius?: number
  minWidth?: number
  fontSize?: number
}) {
  return (
    <div
      className="flex h-[46px] items-center justify-center font-[Roboto,system-ui]"
      style={{
        flex,
        minWidth,
        background: bg,
        borderRadius: radius,
        fontSize,
        color: MD.onPrimaryContainer,
      }}
    >
      {label}
    </div>
  )
}

export function AndroidKeyboard() {
  const row = (keys: string[], style?: CSSProperties) => (
    <div className="flex justify-center gap-1.5" style={style}>
      {keys.map((l, i) => (
        <Key key={`${l}-${i}`} label={l} />
      ))}
    </div>
  )
  return (
    <div
      className="flex flex-col gap-1 px-2 pb-2"
      style={{ background: MD.inverseOnSurface }}
    >
      <div className="h-11" />
      <div className="flex flex-col gap-3">
        {row(["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"])}
        {row(["a", "s", "d", "f", "g", "h", "j", "k", "l"], { padding: "0 20px" })}
        <div className="flex gap-1.5">
          <Key label="" bg={MD.surfaceVariant} />
          <div className="flex min-w-[274px] flex-7 gap-1.5">
            {["z", "x", "c", "v", "b", "n", "m"].map((l) => (
              <Key key={l} label={l} />
            ))}
          </div>
          <Key label="" bg={MD.surfaceVariant} />
        </div>
        <div className="flex gap-1.5">
          <Key label="?123" bg={MD.secondaryContainer} radius={100} minWidth={58} fontSize={14} />
          <Key label="," bg={MD.surfaceVariant} />
          <Key label="" flex={3} minWidth={154} />
          <Key label="." bg={MD.surfaceVariant} />
          <Key label="" bg={MD.primaryFixedDim} radius={100} minWidth={58} />
        </div>
      </div>
    </div>
  )
}

export interface AndroidDeviceProps {
  children?: ReactNode
  width?: number
  height?: number
  dark?: boolean
  title?: string
  large?: boolean
  keyboard?: boolean
  bg?: string
  className?: string
}

export function AndroidDevice({
  children,
  width = 412,
  height = 892,
  dark = false,
  title,
  large = false,
  keyboard = false,
  bg,
  className,
}: AndroidDeviceProps) {
  return (
    <div
      data-om-starter="android-frame"
      className={cn(
        "box-border flex flex-col overflow-hidden rounded-[18px] shadow-[0_30px_80px_rgba(0,0,0,0.25)]",
        className
      )}
      style={{
        width,
        height,
        background: bg ?? (dark ? "#1d1b20" : MD.surface),
        border: `8px solid ${MD.frameBorder}`,
      }}
    >
      <AndroidStatusBar dark={dark} />
      {title !== undefined && <AndroidAppBar title={title} large={large} />}
      <div className="no-scrollbar flex-1 overflow-auto">{children}</div>
      {keyboard && <AndroidKeyboard />}
      <AndroidNavBar dark={dark} />
    </div>
  )
}
