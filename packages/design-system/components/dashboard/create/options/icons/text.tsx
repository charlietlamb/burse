'use client'

import type { AnimationControls, Variants } from 'motion/react'
import { motion } from 'motion/react'

export default function TextIcon({
  controls,
  variants,
}: {
  controls: AnimationControls
  variants: Variants
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <motion.path
        d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"
        variants={variants}
        animate={controls}
        transition={{
          duration: 0.5,
          repeat: 1,
          ease: 'easeInOut',
        }}
      />
    </svg>
  )
}
