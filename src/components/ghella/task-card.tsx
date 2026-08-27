import { AnimatePresence, motion } from "framer-motion"

import { useT } from "@/i18n/use-t"
import { TASK_COLOR } from "@/lib/colors"
import { fadeUp } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { useApp } from "@/store/app-store"
import type { Task } from "@/hooks/use-calendar"

import { WaterDrop } from "./icons"

const CHIP_BG = {
  w: "bg-water-tint",
  t: "bg-sun-tint",
  s: "bg-chip-3",
  r: "bg-leaf-tint",
} as const

/**
 * One row of the Today feed. Everything about a task is on the card: what to
 * do, the computed quantity, why today, and what the weather did to it.
 */
export function TaskCard({ task }: { task: Task }) {
  const { t, td } = useT()
  const cycleTask = useApp((s) => s.cycleTask)

  const done = task.status === "done"
  const skipped = task.status === "skipped"
  const snoozed = task.status === "snoozed"
  const color = TASK_COLOR[task.kind]
  const typeLabel = {
    w: td.wType,
    t: td.tType,
    s: td.sType,
    r: td.rType,
  }[task.kind]

  return (
    <motion.div
      variants={fadeUp}
      layout
      animate={{ opacity: snoozed ? 0.55 : 1 }}
      className="flex overflow-hidden rounded-[13px] border border-line bg-card"
    >
      <div className="w-1.5 flex-none" style={{ background: color }} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-[13px] py-[11px]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-[6px] px-[7px] py-[2.5px] font-mono text-[9.5px] font-bold tracking-[0.08em]",
              CHIP_BG[task.kind]
            )}
            style={{ color }}
          >
            {typeLabel}
          </span>
          <span className="font-mono text-[10.5px] font-bold text-muted">{task.parcel}</span>
          {task.moved && (
            <span className="rounded-[6px] bg-water-tint px-[7px] py-[2.5px] font-mono text-[9.5px] font-bold text-water-deep">
              {task.moved}
            </span>
          )}
          {task.cost && (
            <span className="ms-auto font-mono text-[10.5px] font-bold whitespace-nowrap text-muted">
              {task.cost}
            </span>
          )}
        </div>

        <div
          className={cn(
            "text-[14.5px] leading-[1.25] font-bold",
            done || skipped ? "text-sand line-through" : "text-ink"
          )}
        >
          {task.title}
        </div>

        {task.calc && (
          <div className="font-mono text-[12px] font-bold" style={{ color }}>
            {task.calc}
          </div>
        )}

        {task.why && (
          <div className="text-[11.5px] leading-[1.45] text-muted">{task.why}</div>
        )}

        <AnimatePresence>
          {task.cancelNote && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex items-center gap-[7px] rounded-lg bg-water-tint px-[9px] py-1.5"
            >
              <WaterDrop size={13} />
              <span className="text-[11px] font-bold text-water-deep">{task.cancelNote}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-[7px] pt-0.5">
          <button
            type="button"
            onClick={() => cycleTask(task.id, "done")}
            className={cn(
              "flex-1 cursor-pointer rounded-lg py-[7px] text-center text-[12px] font-bold transition-colors",
              done ? "bg-leaf text-white" : "bg-leaf-tint text-leaf-deep"
            )}
          >
            ✓ {t.tDone}
          </button>
          <button
            type="button"
            onClick={() => cycleTask(task.id, "snoozed")}
            className={cn(
              "cursor-pointer rounded-lg border-[1.5px] px-3 py-[7px] text-[12px] font-semibold transition-colors",
              snoozed ? "border-water bg-water-tint text-water-deep" : "border-line-strong text-muted"
            )}
          >
            {t.tSnooze}
          </button>
          <button
            type="button"
            onClick={() => cycleTask(task.id, "skipped")}
            className={cn(
              "cursor-pointer rounded-lg border-[1.5px] px-3 py-[7px] text-[12px] font-semibold transition-colors",
              skipped ? "border-clay bg-clay-tint text-clay" : "border-line-strong text-muted"
            )}
          >
            {t.tSkip}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
