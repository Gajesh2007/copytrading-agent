import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--outline)] bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="pixel-heading mb-3 text-sm">[SIGMA] Arena</h3>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Automated copy trading agent that mirrors leader positions with configurable risk controls.
            </p>
          </div>
          
          <div>
            <h3 className="pixel-heading mb-3 text-sm">Resources</h3>
            <ul className="space-y-2 font-mono text-xs">
              <li>
                <Link 
                  href="https://github.com/Gajesh2007/copytrading-agent" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  GitHub Repository
                </Link>
              </li>
              <li>
                <Link 
                  href="https://nof1.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Nof1.ai Alpha Arena
                </Link>
              </li>
              <li>
                <Link 
                  href="https://hyperliquid.xyz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Hyperliquid
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="pixel-heading mb-3 text-sm">Disclaimer</h3>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              This is experimental software. Trading carries risk. No guarantees on performance. 
              Use at your own risk.
            </p>
          </div>

          <div>
            <h3 className="pixel-heading mb-3 text-sm">Execution Verified by</h3>
            <Link 
              href="https://docs.eigencloud.xyz/products/eigencompute/quickstart" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:opacity-80 transition-opacity"
            >
              <Image 
                src="/eigencloud-logo.png" 
                alt="EigenCloud"
                width={240}
                height={56}
                className="h-14 w-auto"
              />
            </Link>
          </div>
        </div>
        
        <div className="mt-8 border-t border-[var(--outline)] pt-6">
          <p className="text-center font-mono text-[10px] text-muted-foreground uppercase tracking-[0.24em]">
            © 2025 Sigma Arena by <Link href="https://x.com/gajesh" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Gajesh</Link> · Experimental Software · All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
}

