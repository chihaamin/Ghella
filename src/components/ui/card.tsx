import * as React from "react"

import { cn } from "@/lib/utils"

/** The white 1px-bordered card that carries most of the app's content. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col rounded-[13px] border border-line bg-card",
        className
      )}
      {...props}
    />
  )
}

/** The inverted variant — ink background, cream/amber type. */
function CardDark({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-dark"
      className={cn(
        "flex flex-col rounded-[16px] bg-ink text-surface",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-display text-[15px] font-bold", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

export { Card, CardDark, CardHeader, CardTitle, CardContent }
