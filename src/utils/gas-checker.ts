import { ethers } from 'ethers';
import { getProvider } from '../lib/blockchain';

export interface GasPrices {
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  baseFee?: string;
  formatted: {
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    baseFee?: string;
  };
}

export async function getCurrentGasPrices(): Promise<GasPrices> {
  try {
    const provider = getProvider();
    
    // Get current gas price using getFeeData (more reliable)
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei'); // fallback to 20 gwei
    
    const result: GasPrices = {
      gasPrice: gasPrice.toString(),
      formatted: {
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei'
      }
    };
    
    // Add EIP-1559 fee data if available
    if (feeData.maxFeePerGas) {
      result.maxFeePerGas = feeData.maxFeePerGas.toString();
      result.formatted.maxFeePerGas = ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei';
    }
    
    if (feeData.maxPriorityFeePerGas) {
      result.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.toString();
      result.formatted.maxPriorityFeePerGas = ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') + ' gwei';
    }
    
    // Get latest block to check base fee
    try {
      const latestBlock = await provider.getBlock('latest');
      if (latestBlock?.baseFeePerGas) {
        result.baseFee = latestBlock.baseFeePerGas.toString();
        result.formatted.baseFee = ethers.formatUnits(latestBlock.baseFeePerGas, 'gwei') + ' gwei';
      }
    } catch (blockError) {
      console.log('Could not fetch latest block base fee:', blockError);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching gas prices:', error);
    throw new Error(`Failed to fetch gas prices: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function analyzeGasPrices(gasPrices: GasPrices) {
  const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrices.gasPrice, 'gwei'));
  
  let analysis = {
    level: 'normal' as 'low' | 'normal' | 'high' | 'very_high',
    recommendation: '',
    bufferSuggestion: 20
  };
  
  if (gasPriceGwei < 10) {
    analysis.level = 'low';
    analysis.recommendation = 'Gas prices are low. Good time for transactions.';
    analysis.bufferSuggestion = 20;
  } else if (gasPriceGwei < 30) {
    analysis.level = 'normal';
    analysis.recommendation = 'Gas prices are normal.';
    analysis.bufferSuggestion = 30;
  } else if (gasPriceGwei < 100) {
    analysis.level = 'high';
    analysis.recommendation = 'Gas prices are high. Consider waiting or increasing gas buffer.';
    analysis.bufferSuggestion = 50;
  } else {
    analysis.level = 'very_high';
    analysis.recommendation = 'Gas prices are very high. Strong recommendation to wait or use higher buffer.';
    analysis.bufferSuggestion = 100;
  }
  
  return analysis;
}

export async function checkGasAndRecommendBuffer(): Promise<{
  gasPrices: GasPrices;
  analysis: ReturnType<typeof analyzeGasPrices>;
}> {
  const gasPrices = await getCurrentGasPrices();
  const analysis = analyzeGasPrices(gasPrices);
  
  return {
    gasPrices,
    analysis
  };
}