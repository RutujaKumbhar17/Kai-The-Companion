import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Play, Zap, Palette, BarChart3, Shield } from "lucide-react";
import Hls from "hls.js";
import { BlurText } from "./components/BlurText";

const Navbar = () => (
  <nav className="fixed top-4 left-0 w-full z-50 px-6">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <div className="w-12 h-12 flex items-center justify-center">
         <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black font-bold">K.</div>
      </div>
      <div className="liquid-glass rounded-full px-6 py-2 flex items-center gap-8">
        {["Home", "Services", "Work", "Process", "Pricing"].map((link) => (
          <a key={link} href={`#${link.toLowerCase()}`} className="text-sm font-medium text-white/90 hover:text-white transition-colors">
            {link}
          </a>
        ))}
      </div>
      <button className="bg-white text-black font-body rounded-full px-6 py-2 text-sm font-medium flex items-center gap-2 hover:bg-white/90 transition-all">
        Get Started <ArrowUpRight size={16} />
      </button>
    </div>
  </nav>
);

const SectionBadge = ({ children }: { children: React.ReactNode }) => (
  <div className="badge-pill">{children}</div>
);

const HlsVideo = ({ src, className, desaturated = false }: { src: string; className?: string; desaturated?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(videoRef.current);
      } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = src;
      }
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      loop
      muted
      playsInline
      style={desaturated ? { filter: "saturate(0)" } : {}}
    />
  );
};

export default function App() {
  return (
    <div className="bg-black min-h-screen text-white overflow-visible selection:bg-white selection:text-black">
      <Navbar />

      {/* SECTION 2 — HERO */}
      <section className="relative h-[1000px] w-full overflow-visible flex flex-col items-center pt-[150px] px-6 text-center">
        <video
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4"
          className="absolute top-[20%] left-0 w-full h-auto object-contain z-0"
          autoPlay
          loop
          muted
          playsInline
          poster="/images/hero_bg.jpeg"
        />
        <div className="absolute inset-0 bg-black/5 z-0" />
        <div className="absolute bottom-0 left-0 right-0 h-[300px] video-fade-bottom z-[1]" />

        <div className="z-10 flex flex-col items-center">
          <div className="liquid-glass rounded-full pr-4 pl-1 py-1 flex items-center gap-2 mb-8">
            <span className="bg-white text-black text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">New</span>
            <span className="text-xs font-medium">Introducing AI-powered web design.</span>
          </div>
          
          <BlurText 
            text="The Website Your Brand Deserves"
            className="text-6xl md:text-7xl lg:text-[7rem] font-heading italic text-white leading-[0.8] tracking-[-4px] max-w-4xl"
          />

          <motion.p 
            initial={{ opacity: 0, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-8 text-white/60 max-w-xl text-lg font-light leading-relaxed"
          >
            Stunning design. Blazing performance. Built by AI, refined by experts. This is web design, wildly reimagined.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.1 }}
            className="mt-12 flex items-center gap-6"
          >
            <button className="liquid-glass-strong px-8 py-4 rounded-full flex items-center gap-2 font-medium hover:scale-105 transition-transform">
              Get Started <ArrowUpRight size={18} />
            </button>
            <button className="flex items-center gap-2 font-medium text-white/80 hover:text-white transition-colors">
              <Play size={18} fill="currentColor" /> Watch the Film
            </button>
          </motion.div>
        </div>
      </section>

      {/* SECTION 3 — PARTNERS BAR */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
           <SectionBadge>Trusted by the teams behind</SectionBadge>
           <div className="mt-12 flex flex-wrap justify-center items-center gap-12 md:gap-20">
             {["Stripe", "Vercel", "Linear", "Notion", "Figma"].map(p => (
               <span key={p} className="text-3xl md:text-4xl font-heading italic text-white/40 hover:text-white transition-colors cursor-default">
                 {p}
               </span>
             ))}
           </div>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <section className="relative min-h-[700px] flex items-center justify-center py-32 px-6 overflow-hidden">
        <HlsVideo 
          src="https://stream.mux.com/9JXDljEVWYwWu01PUkAemafDugK89o01BR6zqJ3aS9u00A.m3u8"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
        <div className="absolute top-0 left-0 w-full h-[200px] video-fade-top z-[1]" />
        <div className="absolute bottom-0 left-0 w-full h-[200px] video-fade-bottom z-[1]" />
        
        <div className="z-10 max-w-3xl text-center">
          <SectionBadge>How It Works</SectionBadge>
          <h2 className="text-5xl md:text-7xl mt-6">You dream it. We ship it.</h2>
          <p className="mt-8 text-white/60 text-lg">
            Share your vision. Our AI handles the rest—wireframes, design, code, launch. All in days, not quarters.
          </p>
          <button className="mt-10 liquid-glass-strong px-8 py-4 rounded-full inline-flex items-center gap-2 font-medium">
            Get Started <ArrowUpRight size={18} />
          </button>
        </div>
      </section>

      {/* SECTION 5 — FEATURES CHESS */}
      <section className="py-32 px-6 md:px-16 lg:px-24 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <SectionBadge>Capabilities</SectionBadge>
          <h2 className="text-5xl md:text-6xl mt-4">Pro features. Zero complexity.</h2>
        </div>

        <div className="space-y-48">
          {/* Row 1 */}
          <div className="flex flex-col lg:flex-row items-center gap-20">
             <div className="flex-1">
                <h3 className="text-4xl lg:text-5xl">Designed to convert. Built to perform.</h3>
                <p className="mt-6 text-white/60 text-lg">
                  Every pixel is intentional. Our AI studies what works across thousands of top sites—then builds yours to outperform them all.
                </p>
                <button className="mt-8 liquid-glass-strong px-6 py-3 rounded-full text-sm font-medium">Learn more</button>
             </div>
             <div className="flex-1 w-full aspect-video liquid-glass rounded-2xl overflow-hidden">
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                   <div className="text-white/20 italic">Visual Showcase</div>
                </div>
             </div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col lg:flex-row-reverse items-center gap-20">
             <div className="flex-1">
                <h3 className="text-4xl lg:text-5xl">It gets smarter. Automatically.</h3>
                <p className="mt-6 text-white/60 text-lg">
                  Your site evolves on its own. AI monitors every click, scroll, and conversion—then optimizes in real time. No manual updates. Ever.
                </p>
                <button className="mt-8 liquid-glass-strong px-6 py-3 rounded-full text-sm font-medium">See how it works</button>
             </div>
             <div className="flex-1 w-full aspect-video liquid-glass rounded-2xl overflow-hidden">
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                   <div className="text-white/20 italic">Optimization Visual</div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — FEATURES GRID */}
      <section className="py-32 px-6 md:px-16 lg:px-24 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <SectionBadge>Why Us</SectionBadge>
          <h2 className="text-5xl md:text-6xl mt-4 mb-16">The difference is everything.</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<Zap size={20} />}
              title="Days, Not Months"
              desc="Concept to launch at a pace that redefines fast."
            />
            <FeatureCard 
              icon={<Palette size={20} />}
              title="Obsessively Crafted"
              desc="Every detail considered. Every element refined."
            />
            <FeatureCard 
              icon={<BarChart3 size={20} />}
              title="Built to Convert"
              desc="Layouts informed by data. Decisions backed by performance."
            />
            <FeatureCard 
              icon={<Shield size={20} />}
              title="Secure by Default"
              desc="Enterprise-grade protection comes standard."
            />
          </div>
        </div>
      </section>

      {/* SECTION 7 — STATS */}
      <section className="relative py-32 px-6 overflow-hidden">
         <HlsVideo 
          src="https://stream.mux.com/NcU3HlHeF7CUL86azTTzpy3Tlb00d6iF3BmCdFslMJYM.m3u8"
          className="absolute inset-0 w-full h-full object-cover z-0"
          desaturated
        />
        <div className="absolute top-0 left-0 w-full h-[200px] video-fade-top z-[1]" />
        <div className="absolute bottom-0 left-0 w-full h-[200px] video-fade-bottom z-[1]" />

        <div className="z-10 max-w-5xl mx-auto liquid-glass rounded-3xl p-12 md:p-16 grid grid-cols-2 lg:grid-cols-4 gap-12 text-center backdrop-blur-xl">
          <Stat value="200+" label="Sites launched" />
          <Stat value="98%" label="Client satisfaction" />
          <Stat value="3.2x" label="More conversions" />
          <Stat value="5 days" label="Average delivery" />
        </div>
      </section>

      {/* SECTION 8 — TESTIMONIALS */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <SectionBadge>What They Say</SectionBadge>
          <h2 className="text-5xl md:text-6xl mt-4">Don't take our word for it.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <Testimonial 
            quote="A complete rebuild in five days. The AI caught things our previous team missed in five months."
            name="Sarah Chen"
            role="CEO Luminary"
           />
           <Testimonial 
            quote="Conversions up 4x within the first week. The optimization engine is pure magic."
            name="Marcus Webb"
            role="Head of Growth Arcline"
           />
           <Testimonial 
            quote="They didn't just design our site; they built a digital experience that feels alive."
            name="Elena Voss"
            role="Brand Director Helix"
           />
        </div>
      </section>

      {/* SECTION 9 — CTA FOOTER */}
      <section className="relative py-48 px-6 text-center overflow-hidden">
        <HlsVideo 
          src="https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8"
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-40"
        />
        <div className="absolute top-0 left-0 w-full h-[300px] video-fade-top z-[1]" />
        <div className="z-10">
          <h2 className="text-6xl md:text-8xl">Your next website starts here.</h2>
          <p className="mt-8 text-white/60 text-xl max-w-2xl mx-auto">
            Book a free strategy call. See what AI-powered design can do.
          </p>
          <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-6">
            <button className="liquid-glass-strong px-10 py-5 rounded-full font-bold text-lg hover:scale-105 transition-transform">Book a Call</button>
            <button className="bg-white text-black px-10 py-5 rounded-full font-bold text-lg hover:bg-white/90">View Pricing</button>
          </div>
        </div>

        <footer className="mt-48 pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 text-white/40 text-xs">
          <span>&copy; 2026 Studio. All rights reserved.</span>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </footer>
      </section>
    </div>
  );
}

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="liquid-glass rounded-2xl p-8 hover:bg-white/[0.03] transition-colors border-white/5 border">
    <div className="liquid-glass-strong w-10 h-10 rounded-full flex items-center justify-center mb-6">
      {icon}
    </div>
    <h3 className="text-xl mb-4 italic leading-tight">{title}</h3>
    <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
  </div>
);

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col gap-2">
    <span className="text-4xl md:text-6xl font-heading italic">{value}</span>
    <span className="text-white/60 text-xs uppercase tracking-widest">{label}</span>
  </div>
);

const Testimonial = ({ quote, name, role }: { quote: string; name: string; role: string }) => (
  <div className="liquid-glass rounded-2xl p-10 flex flex-col justify-between border-white/5 border">
    <p className="text-white/80 text-lg leading-relaxed italic">"{quote}"</p>
    <div className="mt-10">
       <div className="font-medium text-white">{name}</div>
       <div className="text-white/50 text-xs mt-1">{role}</div>
    </div>
  </div>
);
