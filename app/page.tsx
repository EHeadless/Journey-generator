import InputForm from '@/components/InputForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#131313]">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-header flex justify-between items-center px-8 h-16 shadow-2xl shadow-black/40">
        <div className="text-xl font-bold tracking-tighter text-[#E2E2E2]">
          Journey Generator
        </div>
        <div className="text-xs text-[#c4c5d9]/40 uppercase tracking-wider">
          Behavioral Strategy Engine
        </div>
        <div className="w-20" />
      </header>

      <main className="pt-20 pb-16">
        {/* Page Header */}
        <section className="px-8 md:px-16 py-10 border-b border-[#434656]/10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-[#e2e2e2] mb-3">Define Your Brief</h1>
            <p className="text-sm text-[#c4c5d9]/60 max-w-xl mx-auto">
              Start by describing your business context. The AI will generate a <strong className="text-[#e2e2e2]">demand landscape</strong>:
              journey phases, demand spaces (Jobs to Be Done), and circumstances for each.
            </p>
          </div>
        </section>

        {/* Quick Reference */}
        <section className="px-8 md:px-16 py-6 bg-[#1b1b1b]/50 border-b border-[#434656]/10">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4">
                <div className="text-sm font-medium text-[#c4c5d9]/70">Journey Phases</div>
                <p className="text-xs text-[#c4c5d9]/40 mt-1">Customer lifecycle stages</p>
              </div>
              <div className="p-4">
                <div className="text-sm font-medium text-[#4ade80]">Demand Spaces</div>
                <p className="text-xs text-[#c4c5d9]/40 mt-1">Jobs to Be Done per phase</p>
              </div>
              <div className="p-4">
                <div className="text-sm font-medium text-[#a855f7]">Circumstances</div>
                <p className="text-xs text-[#c4c5d9]/40 mt-1">Situational factors per demand</p>
              </div>
            </div>
          </div>
        </section>

        {/* Form Section */}
        <section className="px-8 md:px-16 py-10">
          <div className="max-w-2xl mx-auto">
            <InputForm />
          </div>
        </section>
      </main>
    </div>
  );
}
