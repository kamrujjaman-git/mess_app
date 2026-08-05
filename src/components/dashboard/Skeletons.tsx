interface SummaryCardSkeletonProps {
    count?: number;
}

export function SummaryCardSkeleton({ count = 4 }: SummaryCardSkeletonProps) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="animate-pulse rounded-2xl bg-slate-200/70 p-3.5 shadow-sm sm:p-5 dark:bg-slate-700/30"
                >
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="h-4 w-24 rounded-full bg-slate-300/70" />
                        <div className="h-10 w-10 rounded-2xl bg-slate-300/70" />
                    </div>
                    <div className="h-9 w-32 rounded-full bg-slate-300/70" />
                    <div className="mt-3 h-3 w-20 rounded-full bg-slate-300/70" />
                </div>
            ))}
        </div>
    );
}

export function LogCardSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, cardIndex) => (
                <div
                    key={cardIndex}
                    className="animate-pulse overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100/80 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/40"
                >
                    <div className="border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/60 sm:px-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="h-4 w-44 rounded-full bg-slate-300/70" />
                            <div className="h-4 w-16 rounded-full bg-slate-300/70" />
                        </div>
                    </div>

                    <div className="space-y-3 p-4 sm:p-6">
                        {Array.from({ length: 3 }).map((_, rowIndex) => (
                            <div
                                key={rowIndex}
                                className="rounded-2xl border border-slate-200/70 bg-slate-200/60 p-4 dark:border-slate-700/60 dark:bg-slate-800/50"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="h-4 w-36 rounded-full bg-slate-300/70" />
                                    <div className="h-4 w-16 rounded-full bg-slate-300/70" />
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <div className="h-3 w-full rounded-full bg-slate-300/70" />
                                    <div className="h-3 w-full rounded-full bg-slate-300/70" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function MealSheetSkeleton() {
    return (
        <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100/80 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/40">
            <div className="border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/60 sm:px-6">
                <div className="h-4 w-48 rounded-full bg-slate-300/70" />
                <div className="mt-2 h-3 w-72 rounded-full bg-slate-300/70" />
            </div>

            <div className="hidden overflow-x-auto overflow-y-hidden scroll-smooth lg:block">
                <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-10 bg-gradient-to-l from-slate-100/80 to-transparent dark:from-slate-900/70 lg:block" />
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                            <th className="sticky left-0 bg-white/80 px-4 py-3 backdrop-blur dark:bg-slate-900/80 sm:px-6">
                                <div className="h-4 w-24 rounded-full bg-slate-300/70" />
                            </th>
                            {Array.from({ length: 3 }).map((_, index) => (
                                <th key={index} className="px-2 py-3 text-center font-medium">
                                    <div className="h-4 w-16 rounded-full bg-slate-300/70 mx-auto" />
                                </th>
                            ))}
                        </tr>
                        <tr className="border-b border-slate-200/60 text-left text-[10px] uppercase text-slate-400 dark:border-slate-700/60">
                            <th className="sticky left-0 bg-white/80 px-4 py-2 backdrop-blur dark:bg-slate-900/80 sm:px-6" />
                            {Array.from({ length: 9 }).map((_, index) => (
                                <th key={index} className="px-1 py-2 text-center font-normal">
                                    <div className="h-3 w-8 rounded-full bg-slate-300/70 mx-auto" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 4 }).map((_, rowIndex) => (
                            <tr key={rowIndex} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                <td className="sticky left-0 whitespace-nowrap bg-white/80 px-4 py-3 backdrop-blur dark:bg-slate-900/80 sm:px-6">
                                    <div className="h-4 w-20 rounded-full bg-slate-300/70" />
                                    <div className="mt-2 h-3 w-16 rounded-full bg-slate-300/70" />
                                </td>
                                {Array.from({ length: 9 }).map((_, cellIndex) => (
                                    <td key={cellIndex} className="px-1 py-3 text-center">
                                        <div className="mx-auto h-9 min-w-[2.5rem] rounded-full bg-slate-200/70" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
