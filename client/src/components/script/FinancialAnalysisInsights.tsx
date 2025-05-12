// client/src/components/script/FinancialAnalysisInsights.tsx
import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { FaLink, FaFileExport, FaPercentage, FaDollarSign, FaMapMarkerAlt, FaShoppingCart } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScriptCharacter, ClientSuggestedLocation, SceneVariation } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface FinancialAnalysisInsightsProps {
  projectName: string;
  expectedReleaseDate: string; 
  totalBudget: number;
  selectedCharacters: ScriptCharacter[];
  selectedLocations: ClientSuggestedLocation[];
  selectedProducts: SceneVariation[];
}

export default function FinancialAnalysisInsights({
  projectName,
  expectedReleaseDate,
  totalBudget,
  selectedCharacters,
  selectedLocations,
  selectedProducts
}: FinancialAnalysisInsightsProps) {
  const [insights, setInsights] = useState<{
    sponsorshipAmount: number;
    locationIncentivesAmount: number;
    externalCapitalRequired: number;
    sponsorshipPercentage: number;
    locationIncentivesPercentage: number;
    externalCapitalPercentage: number;
    analysisText: string;
    sponsorshipDetails: string[];
    locationDetails: string[];
  }>({
    sponsorshipAmount: 0,
    locationIncentivesAmount: 0,
    externalCapitalRequired: 0,
    sponsorshipPercentage: 0,
    locationIncentivesPercentage: 0,
    externalCapitalPercentage: 0,
    analysisText: '',
    sponsorshipDetails: [],
    locationDetails: []
  });

  // Calculate financial metrics when inputs change
  useEffect(() => {
    if (!totalBudget) return;

    // Estimate sponsorship potential 
    // (In a real app, this would come from a more sophisticated model or API)
    const sponsorshipPerProduct = totalBudget * 0.05; // Each product worth about 5% of budget
    const sponsorshipAmount = selectedProducts.length * sponsorshipPerProduct;
    
    // Estimate location incentives
    // (In a real app, this would use actual incentive percentages from a database)
    const estimatedIncentiveRate = 0.20; // 20% baseline tax credit
    const locationIncentivesAmount = selectedLocations.length > 0 
      ? totalBudget * estimatedIncentiveRate 
      : 0;
    
    // Calculate remaining budget needed
    const externalCapitalRequired = Math.max(0, totalBudget - sponsorshipAmount - locationIncentivesAmount);
    
    // Calculate percentages
    const sponsorshipPercentage = (sponsorshipAmount / totalBudget) * 100;
    const locationIncentivesPercentage = (locationIncentivesAmount / totalBudget) * 100;
    const externalCapitalPercentage = (externalCapitalRequired / totalBudget) * 100;
    
    // Generate sponsorship details
    const sponsorshipDetails = selectedProducts.map(product => 
      `${product.productCategory} ${product.productName}: Estimated value $${(sponsorshipPerProduct).toLocaleString()}`
    );
    
    // Generate location details
    const locationDetails = selectedLocations.map(location => 
      `${location.region}, ${location.country}: ${location.incentiveProgram || 'Tax Credit Program'} - Estimated value $${(totalBudget * estimatedIncentiveRate / selectedLocations.length).toLocaleString()}`
    );
    
    // Generate analysis text
    let analysisText = `Based on the selected elements for "${projectName}" with a budget of $${totalBudget.toLocaleString()}, our AI analysis indicates:\n\n`;
    
    analysisText += `• Potential brand sponsorships could cover ${sponsorshipPercentage.toFixed(1)}% of your budget ($${sponsorshipAmount.toLocaleString()}).\n`;
    analysisText += `• Location incentives may provide ${locationIncentivesPercentage.toFixed(1)}% of your budget ($${locationIncentivesAmount.toLocaleString()}).\n`;
    analysisText += `• External capital requirement: ${externalCapitalPercentage.toFixed(1)}% of your budget ($${externalCapitalRequired.toLocaleString()}).\n\n`;
    
    if (sponsorshipAmount > 0) {
      analysisText += `The selected product placements offer significant opportunities for reducing production costs. `;
    }
    
    if (locationIncentivesAmount > 0) {
      analysisText += `Filming in ${selectedLocations.map(l => l.region).join(', ')} offers substantial tax incentives that could significantly reduce your overall budget requirements. `;
    }
    
    // Set the calculated insights
    setInsights({
      sponsorshipAmount,
      locationIncentivesAmount,
      externalCapitalRequired,
      sponsorshipPercentage,
      locationIncentivesPercentage,
      externalCapitalPercentage,
      analysisText,
      sponsorshipDetails,
      locationDetails
    });
  }, [totalBudget, selectedProducts, selectedLocations, selectedCharacters, projectName]);

  // Format the date to be more readable
  const formattedReleaseDate = new Date(expectedReleaseDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Data for the pie chart
  const pieData = [
    { name: 'Brand Sponsorships', value: insights.sponsorshipPercentage },
    { name: 'Location Incentives', value: insights.locationIncentivesPercentage },
    { name: 'External Capital Required', value: insights.externalCapitalPercentage }
  ];
  
  // Colors for the pie chart segments
  const COLORS = ['#0ea5e9', '#22c55e', '#8b5cf6'];

  return (
    <div className="space-y-8">
      {/* Project Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{projectName}</CardTitle>
          <CardDescription>
            Expected Release: {formattedReleaseDate} • Total Budget: ${totalBudget.toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Budget Funding Progress</span>
                <span className="text-sm font-medium">{(insights.sponsorshipPercentage + insights.locationIncentivesPercentage).toFixed(1)}%</span>
              </div>
              <Progress value={insights.sponsorshipPercentage + insights.locationIncentivesPercentage} className="h-2" />
            </div>
            
            <div className="pt-4">
              <h4 className="text-sm font-medium mb-2">Funding Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center text-sm mb-1">
                    <FaShoppingCart className="mr-2 text-blue-500" />
                    <span>Brand Sponsorships</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">${insights.sponsorshipAmount.toLocaleString()}</span>
                    <span className="text-sm self-end text-blue-500">{insights.sponsorshipPercentage.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="rounded-lg border p-3">
                  <div className="flex items-center text-sm mb-1">
                    <FaMapMarkerAlt className="mr-2 text-green-500" />
                    <span>Location Incentives</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">${insights.locationIncentivesAmount.toLocaleString()}</span>
                    <span className="text-sm self-end text-green-500">{insights.locationIncentivesPercentage.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="rounded-lg border p-3">
                  <div className="flex items-center text-sm mb-1">
                    <FaDollarSign className="mr-2 text-purple-500" />
                    <span>External Capital Required</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">${insights.externalCapitalRequired.toLocaleString()}</span>
                    <span className="text-sm self-end text-purple-500">{insights.externalCapitalPercentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Visualization & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Distribution</CardTitle>
            <CardDescription>Visual breakdown of funding sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* AI Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>AI Financial Analysis</CardTitle>
            <CardDescription>Generated by Gemini 2.5 Pro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm text-gray-700">
              {insights.analysisText}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown Tabs */}
      <Tabs defaultValue="sponsorships">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sponsorships">Brand Sponsorships</TabsTrigger>
          <TabsTrigger value="locations">Location Incentives</TabsTrigger>
        </TabsList>
        
        {/* Sponsorships Tab */}
        <TabsContent value="sponsorships" className="border rounded-md p-4 mt-4">
          <h3 className="text-lg font-medium mb-4">Brand Sponsorship Opportunities</h3>
          
          {selectedProducts.length > 0 ? (
            <div className="space-y-4">
              <ul className="space-y-2">
                {insights.sponsorshipDetails.map((detail, index) => (
                  <li key={index} className="flex justify-between border-b pb-2">
                    <span>{detail}</span>
                    <Button variant="outline" size="sm" className="h-7">
                      <FaLink className="h-3 w-3 mr-1" /> Details
                    </Button>
                  </li>
                ))}
              </ul>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
                <p className="text-blue-800">
                  These brand sponsorships are estimated to cover {insights.sponsorshipPercentage.toFixed(1)}% of your 
                  total budget (${insights.sponsorshipAmount.toLocaleString()}).
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 italic">No brand products selected yet.</p>
          )}
        </TabsContent>
        
        {/* Locations Tab */}
        <TabsContent value="locations" className="border rounded-md p-4 mt-4">
          <h3 className="text-lg font-medium mb-4">Location Incentives & Tax Credits</h3>
          
          {selectedLocations.length > 0 ? (
            <div className="space-y-4">
              <ul className="space-y-2">
                {insights.locationDetails.map((detail, index) => (
                  <li key={index} className="flex justify-between border-b pb-2">
                    <span>{detail}</span>
                    <Button variant="outline" size="sm" className="h-7">
                      <FaLink className="h-3 w-3 mr-1" /> Program Info
                    </Button>
                  </li>
                ))}
              </ul>
              
              <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
                <p className="text-green-800">
                  These location incentives are estimated to cover {insights.locationIncentivesPercentage.toFixed(1)}% of your 
                  total budget (${insights.locationIncentivesAmount.toLocaleString()}).
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 italic">No filming locations selected yet.</p>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Export Actions */}
      <div className="flex justify-center pt-4">
        <Button className="w-full max-w-md flex items-center gap-2">
          <FaFileExport className="h-4 w-4" />
          Export Financial Analysis Report
        </Button>
      </div>
    </div>
  );
}