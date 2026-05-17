import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Heart } from "lucide-react";

export default function EnvelopeLetter() {
  const [isOpen, setIsOpen] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the letter
    const hasSeenInfo = localStorage.getItem("hasSeenYamLetter_msg4");
    if (hasSeenInfo) {
      setIsDismissed(true);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => {
      setShowLetter(true);
    }, 600);
  };

  const handleClose = () => {
    setIsDismissed(true);
    localStorage.setItem("hasSeenYamLetter_msg4", "true");
  };

  if (isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <div className="relative w-full max-w-lg perspective-1000">
          {/* Envelope */}
          <motion.div
            animate={
              isOpen
                ? { y: 200, opacity: 0, scale: 0.8 }
                : { y: 0, opacity: 1, scale: 1 }
            }
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className={`relative w-full max-w-sm mx-auto h-64 bg-pink-100 rounded-b-lg shadow-xl flex items-center justify-center cursor-pointer transform transition-transform hover:scale-105 ${isOpen ? "pointer-events-none" : ""}`}
            onClick={handleOpen}
          >
            {/* Top flap */}
            <motion.div
              className="absolute top-0 left-0 w-full h-0 border-l-[192px] border-l-transparent border-r-[192px] border-r-transparent border-t-[128px] border-t-pink-300 origin-top z-20"
              animate={isOpen ? { rotateX: 180, zIndex: 0 } : { rotateX: 0 }}
              transition={{ duration: 0.6 }}
              style={{ transformStyle: "preserve-3d" }}
            />
            {/* Body of envelope details */}
            <div className="absolute inset-x-0 bottom-0 top-[2px] bg-pink-200 z-10 rounded-b-lg pointer-events-none overflow-hidden">
              {/* Left and right triangle flaps */}
              <div className="absolute top-0 left-0 w-0 h-0 border-t-[128px] border-t-transparent border-l-[192px] border-l-pink-300 opacity-50 z-10"></div>
              <div className="absolute top-0 right-0 w-0 h-0 border-t-[128px] border-t-transparent border-r-[192px] border-r-pink-300 opacity-50 z-10"></div>
              <div className="absolute bottom-0 left-0 w-full h-0 border-b-[128px] border-b-pink-100 border-l-[192px] border-l-transparent border-r-[192px] border-r-transparent z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]"></div>
            </div>

            {!isOpen && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.3,
                  repeat: Infinity,
                  repeatType: "reverse",
                  duration: 1.5,
                }}
                className="absolute z-30 flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 bg-red-400 rounded-full flex items-center justify-center shadow-lg border-4 border-white text-white">
                  <Mail size={32} />
                </div>
                <span className="text-pink-800 font-bold uppercase tracking-widest text-sm bg-white/80 px-4 py-1 rounded-full backdrop-blur-md">
                  Open Me
                </span>
              </motion.div>
            )}
          </motion.div>

          {/* Letter (pops out) */}
          {showLetter && (
            <motion.div
              initial={{ y: 200, opacity: 0, scale: 0.8, rotate: -3 }}
              animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="absolute inset-0 w-[92vw] sm:w-[85vw] md:w-full max-w-lg mx-auto m-auto h-[85vh] max-h-[800px] z-40 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] bg-[#fdfbf7] p-5 sm:p-8 rounded-sm shadow-2xl border flex flex-col justify-between"
            >
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-pink-300 rounded-full flex items-center justify-center shadow-md transform rotate-12 z-50">
                <Heart className="text-white fill-white" size={24} />
              </div>

              <div className="flex-1 font-serif text-slate-700 leading-relaxed space-y-4 text-[13px] sm:text-sm overflow-y-auto pr-2 custom-scrollbar">
                <p className="text-lg sm:text-xl italic font-semibold text-pink-500 mb-2">
                  Hello love love,
                </p>

                <p>
                  alam ko magastos ikaw and i know you are super organized when
                  it comes to things kaya ayan i made our very own financial
                  tracker nye nye - kai
                </p>
              </div>

              <div className="pt-4 mt-auto border-t border-pink-100/50 shrink-0">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClose}
                  className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-pink-400 to-yellow-400 text-white rounded-xl font-bold shadow-[0_4px_14px_0_rgba(244,143,177,0.39)] hover:shadow-[0_6px_20px_rgba(244,143,177,0.23)] hover:to-yellow-300 transition-all text-sm sm:text-base"
                >
                  Go to My Hub
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
