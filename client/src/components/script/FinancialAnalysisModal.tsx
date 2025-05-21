// client/src/components/script/FinancialAnalysisModal.tsx
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { FinancialAnalysisModalProps, FinancialBreakdown, FinancialLineItem } from "@/lib/types";
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, DollarSign, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient"; // Ensure this is correctly imported if needed for direct calls, otherwise props are fine.

const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "$ -";
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

interface SectionProps {
    title: string;
    items: FinancialLineItem[];
    sectionTotal: number | null;
    isSubSection?: boolean;
}

const FinancialSection: React.FC<SectionProps> = ({ title, items, sectionTotal, isSubSection = false }) => (
    <div className={isSubSection ? "pl-4" : ""}>
        <h3 className={`font-semibold mb-2 ${isSubSection ? "text-md" : "text-lg"}`}>{title}</h3>
        <Table className="mb-4">
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[100px] text-xs">Account</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map((item) => (
                    <TableRow key={item.account || item.description}>
                        <TableCell className="font-mono text-xs">{item.account}</TableCell>
                        <TableCell className="text-xs">{item.description}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={2} className="text-xs">Total {title}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(sectionTotal)}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    </div>
);


export default function FinancialAnalysisModal({ isOpen, onClose, scriptId, scriptTitle }: FinancialAnalysisModalProps) {
    const { data: financialData, isLoading, isError, error } = useQuery<FinancialBreakdown>({
        queryKey: [`/api/scripts/${scriptId}/financial-analysis`, scriptId],
        queryFn: async () => {
            if (!scriptId) throw new Error("Script ID is required for financial analysis.");
            const response = await apiRequest("GET", `/api/scripts/${scriptId}/financial-analysis`);
            return response.json();
        },
        enabled: isOpen && !!scriptId, // Only fetch when modal is open and scriptId is available
        refetchOnWindowFocus: false,
    });

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Loading financial analysis...</p>
                </div>
            );
        }

        if (isError) {
            return (
                <div className="flex flex-col items-center justify-center py-10 text-destructive">
                    <AlertTriangle className="h-12 w-12 mb-4" />
                    <p className="font-semibold">Error loading data</p>
                    <p className="text-sm">{(error as Error)?.message || "An unknown error occurred."}</p>
                </div>
            );
        }

        if (!financialData) {
            return (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4" />
                    <p>No financial data available for this script yet.</p>
                    <p className="text-sm">Ensure project budget has been set on the Welcome page.</p>
                </div>
            );
        }

        const {
            projectName, expectedReleaseDate, location, prepWeeks, shootDays, unions,
            aboveTheLine, belowTheLineProduction, postProduction, otherBelowTheLine,
            bondFee, contingency,
            summaryTotalAboveTheLine, summaryTotalBelowTheLine, summaryTotalAboveAndBelowTheLine, summaryGrandTotal,
            totalBudgetInput, estimatedBrandSponsorshipValue, estimatedLocationIncentiveValue, netExternalCapitalRequired
        } = financialData;

        return (
            <ScrollArea className="max-h-[70vh] pr-3">
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs border-b pb-4 mb-4">
                        <div><strong>Location:</strong> {location || '-'}</div>
                        <div><strong>Prep:</strong> {prepWeeks || '-'} WKS</div>
                        <div><strong>Shoot:</strong> {shootDays || '-'}</div>
                        <div><strong>Unions:</strong> {unions || '-'}</div>
                        {expectedReleaseDate && <div><strong>Release:</strong> {new Date(expectedReleaseDate).toLocaleDateString()}</div>}
                    </div>

                    {/* Major Categories */}
                    <FinancialSection title="Above-The-Line" items={[aboveTheLine.storyRights, aboveTheLine.producer, aboveTheLine.director, aboveTheLine.castAndStunts, aboveTheLine.fringes]} sectionTotal={aboveTheLine.total} />
                    <FinancialSection title="Below-The-Line Production" items={Object.values(belowTheLineProduction).filter(item => typeof item === 'object' && item !== null && 'account' in item) as FinancialLineItem[]} sectionTotal={belowTheLineProduction.total} />
                    <FinancialSection title="Post Production" items={Object.values(postProduction).filter(item => typeof item === 'object' && item !== null && 'account' in item) as FinancialLineItem[]} sectionTotal={postProduction.total} />
                    <FinancialSection title="Other Below-The-Line" items={Object.values(otherBelowTheLine).filter(item => typeof item === 'object' && item !== null && 'account' in item) as FinancialLineItem[]} sectionTotal={otherBelowTheLine.total} />

                    {/* Single Items like Bond and Contingency */}
                    <FinancialSection title="" items={[bondFee, contingency]} sectionTotal={null} />

                    {/* Summary Totals */}
                    <div className="mt-6 pt-4 border-t">
                        <h3 className="text-lg font-semibold mb-3">Budget Summary</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span>Total Above-The-Line:</span> <span className="font-mono font-semibold">{formatCurrency(summaryTotalAboveTheLine)}</span></div>
                            <div className="flex justify-between"><span>Total Below-The-Line:</span> <span className="font-mono font-semibold">{formatCurrency(summaryTotalBelowTheLine)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>TOTAL FILM COST (PRE-CONTINGENCY/BOND):</span> <span className="font-mono">{formatCurrency(summaryTotalAboveAndBelowTheLine)}</span></div>
                            <div className="flex justify-between font-bold text-lg border-t-2 border-b-2 py-2 my-2"><span>GRAND TOTAL:</span> <span className="font-mono">{formatCurrency(summaryGrandTotal)}</span></div>
                        </div>
                    </div>

                    {/* Vadis Analysis Section - this part will be enhanced later */}
                    <div className="mt-6 pt-4 border-t">
                        <h3 className="text-lg font-semibold mb-3">Vadis AI Financial Insights</h3>
                        <div className="space-y-2 text-sm p-4 bg-blue-50 rounded-md border border-blue-200">
                            <div className="flex justify-between items-center">
                                <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1 text-gray-600"/>Total Project Budget (Input):</span> 
                                <span className="font-mono font-semibold">{formatCurrency(totalBudgetInput)}</span>
                            </div>
                            <div className="flex justify-between items-center text-green-600">
                                <span className="flex items-center"><TrendingDown className="h-4 w-4 mr-1"/>Est. Brand Sponsorship Value:</span> 
                                <span className="font-mono font-semibold">{formatCurrency(estimatedBrandSponsorshipValue)}</span>
                            </div>
                             <div className="flex justify-between items-center text-green-600">
                                <span className="flex items-center"><TrendingDown className="h-4 w-4 mr-1"/>Est. Location Incentive Value:</span> 
                                <span className="font-mono font-semibold">{formatCurrency(estimatedLocationIncentiveValue)}</span>
                            </div>
                            <div className="flex justify-between items-center font-bold text-blue-700 border-t pt-2 mt-2">
                                <span className="flex items-center"><TrendingUp className="h-4 w-4 mr-1"/>Net External Capital Required:</span> 
                                <span className="font-mono">{formatCurrency(netExternalCapitalRequired)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl md:max-w-4xl lg:max-w-5xl w-[95vw] h-[90vh] flex flex-col">
                <DialogHeader className="pr-10"> {/* Add padding for close button */}
                    <DialogTitle>Project Financial Analysis: {scriptTitle || financialData?.projectName || "Loading..."}</DialogTitle>
                    <DialogDescription>
                        Preliminary financial overview based on current project data and selections.
                        (This is a template view with mostly placeholder values for line items.)
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-grow overflow-hidden">
                    {renderContent()}
                </div>

                <DialogFooter className="mt-auto pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    {/* Add Export to Excel button here in a later task */}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}