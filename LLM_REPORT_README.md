# LLM-Generated Incident Reports (RAG)

This document explains the **AI Incident Report** generation feature, which fulfills the final "Generated Report RAG/LLM" component of the Real-Time Fraud Transaction System architecture diagram.

## Overview

When the machine learning pipeline (LightGBM) flags a transaction as potential fraud, it generates an explainability profile using **TreeSHAP**. This tells us *why* the model made its decision (e.g., unusual amount, strange location). 

To make this data easily understandable for human system administrators and compliance officers, we integrate a **Retrieval-Augmented Generation (RAG)** approach using an LLM.

Instead of reading raw JSON data or raw numbers, the system admin can click a button on the Dashboard to instantly generate a professional, natural-language incident report.

## How It Works

1. **Trigger:** The Admin views a transaction in the "Live Monitoring" dashboard and clicks the "Generate AI Incident Report" button.
2. **Retrieval (Context Gathering):** The FastAPI backend retrieves the full context of the transaction from the PostgreSQL/SQLite database. This includes:
   - Transaction metadata (Amount, Time, Customer ID, Terminal ID)
   - ML Output (Fraud Probability %, Scenario Name, Top Flagging Reason)
   - Explainability Data (The raw SHAP feature contributions)
3. **Augmentation (Prompting):** The backend builds a dynamic prompt injecting all this retrieved data. It instructs the LLM to act as a "Senior Financial Fraud Analyst".
4. **Generation (LLM Call):** The backend makes an API call to **OpenRouter** (defaulting to the `meta-llama/llama-3.1-8b-instruct:free` model).
5. **Persistence:** The generated Markdown report is saved permanently in the `llm_report` column of the `transactions` table. Future requests for this report will load instantly from the cache.

## Configuration

The system uses the OpenRouter API to access LLMs.

To configure it, ensure the following line is present in your root `.env` file:

```env
OPEN_ROUTER_API_KEY=your_openrouter_api_key_here
```

## The Prompts

The system uses two carefully crafted prompts to ensure the LLM output is professional, structured, and strictly based on the real ML data (no hallucinations).

### System Prompt
> "You are a Senior Financial Fraud Analyst at a major bank's fraud investigation unit. You write clear, professional incident reports for flagged transactions. Your reports are read by compliance officers and security teams. Use markdown formatting for structure. Be precise and data-driven. Do not speculate beyond what the data shows. Reference specific SHAP values when explaining contributing factors."

### User Prompt Structure
> "Analyze the following transaction and write a professional incident report:
> 
> **Transaction Details:**
> - Transaction ID: ...
> - Amount: ...
> - Fraud Probability: ...
> - Fraud Scenario: ...
> - Current Status: ...
> 
> **SHAP Feature Contributions (why the model flagged this):**
> - [Feature A]: SHAP value 0.42 (fraud)
> - [Feature B]: SHAP value -0.15 (legitimate)
> 
> Please write a concise but thorough incident report covering:
> 1. Executive Summary
> 2. Risk Assessment
> 3. Key Contributing Factors
> 4. Recommended Actions
> 5. Conclusion"

## How to Test

1. Ensure your backend and frontend are running.
2. Ensure you have a valid `OPEN_ROUTER_API_KEY` in your `.env`.
3. Open the **Admin Dashboard**.
4. Go to the **Live Monitoring** tab.
5. Click on any transaction row to open the details slide-over panel.
6. Scroll down to the bottom and click the **✨ Generate AI Incident Report** button.
7. The report will be generated and displayed with a beautiful purple gradient theme.
