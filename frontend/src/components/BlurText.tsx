import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

interface BlurTextProps {
  text: string;
  className?: string;
  delayOffset?: number;
}

export const BlurText = ({ text, className, delayOffset = 0 }: BlurTextProps) => {
  const words = text.split(" ");
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <div ref={ref} className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
          animate={
            inView
              ? { filter: "blur(0px)", opacity: 1, y: 0 }
              : { filter: "blur(10px)", opacity: 0, y: 50 }
          }
          transition={{
            duration: 0.35,
            delay: delayOffset + i * 0.1,
            ease: "easeOut",
          }}
          className="inline-block mr-[0.2em]"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
};
