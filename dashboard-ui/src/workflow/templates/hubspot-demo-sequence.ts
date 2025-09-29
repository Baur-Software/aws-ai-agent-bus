// HubSpot Demo Email Sequence Workflow Template
// Complete workflow for inviting people to the AI Agent Bus demo

import { WorkflowDefinition } from '../types';

export const hubspotDemoSequenceWorkflow: WorkflowDefinition = {
  version: '1.0.0',
  created: new Date().toISOString(),
  name: 'HubSpot Demo Invitation Sequence',
  description: 'Automated email sequence to invite prospects to the AI Agent Bus demo, with human approval gates and follow-up automation',

  nodes: [
    // 1. Webhook Trigger - When someone shows interest
    {
      id: 'trigger-1',
      type: 'trigger',
      x: 100,
      y: 100,
      inputs: [],
      outputs: ['trigger_data'],
      config: {
        name: 'Demo Interest Trigger',
        description: 'Triggered when someone expresses interest in the demo via website, form, or referral',
        data: {
          source: 'website_form',
          lead_score: 75,
          company_size: 'medium',
          use_case: 'workflow_automation'
        }
      }
    },

    // 2. Get/Create Contact in HubSpot
    {
      id: 'hubspot-contact-1',
      type: 'hubspot-contact',
      x: 300,
      y: 100,
      inputs: ['trigger_data'],
      outputs: ['contact_info'],
      config: {
        action: 'create',
        email: '{{trigger_data.email}}',
        firstName: '{{trigger_data.firstName}}',
        lastName: '{{trigger_data.lastName}}',
        company: '{{trigger_data.company}}',
        phone: '{{trigger_data.phone}}',
        website: '{{trigger_data.website}}',
        properties: {
          lifecycle_stage: 'lead',
          lead_status: 'new',
          lead_source: 'demo_workflow',
          lead_score: '{{trigger_data.lead_score}}',
          company_size: '{{trigger_data.company_size}}',
          use_case: '{{trigger_data.use_case}}'
        },
        listIds: ['demo_prospects', 'workflow_automation_interest']
      }
    },

    // 3. Human Review Gate - Sales team review
    {
      id: 'person-review-1',
      type: 'person',
      x: 500,
      y: 100,
      inputs: ['contact_info'],
      outputs: ['review_decision'],
      config: {
        personType: 'organization_member',
        userId: 'user-alice-456', // Sales manager
        approvalRequired: true,
        timeout: 7200, // 2 hours
        escalationTo: 'user-demo-123', // Admin user
        notificationPreferences: {
          email: true,
          slack: true,
          inApp: true
        }
      }
    },

    // 4. Immediate Welcome Email
    {
      id: 'hubspot-email-1',
      type: 'hubspot-email',
      x: 700,
      y: 50,
      inputs: ['review_decision'],
      outputs: ['welcome_email_sent'],
      config: {
        action: 'send_email',
        subject: 'Welcome to AI Agent Bus - Your Demo Invitation Awaits! 🚀',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Hi {{firstname}}!</h1>

            <p>Thank you for your interest in AI Agent Bus - the future of workflow automation is here!</p>

            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #1e40af; margin-top: 0;">What We'll Show You:</h2>
              <ul>
                <li>🔗 <strong>MCP Server Integration</strong> - Connect any service with our Model Context Protocol</li>
                <li>🎯 <strong>Visual Workflow Builder</strong> - Drag & drop automation like never before</li>
                <li>👥 <strong>Human-in-the-Loop</strong> - Perfect blend of AI and human decision making</li>
                <li>🤖 <strong>AWS Bedrock & Ollama</strong> - Powerful AI backend with multiple model options</li>
                <li>⚡ <strong>Real-time Collaboration</strong> - Miro-like sharing for team workflows</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://demo.aiagentbus.com/schedule?contact={{contact_id}}"
                 style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Schedule Your Personal Demo
              </a>
            </div>

            <p>Best regards,<br>
            <strong>The AI Agent Bus Team</strong><br>
            Building the future of intelligent automation</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <small style="color: #6b7280;">
              This is an automated message from our AI Agent Bus demo workflow.
              You're receiving this because you expressed interest in our platform.
            </small>
          </div>
        `,
        fromEmail: 'demo@aiagentbus.com',
        fromName: 'AI Agent Bus Demo Team',
        trackOpens: true,
        trackClicks: true,
        personalization: {
          firstname: '{{contact_info.firstName}}',
          company: '{{contact_info.company}}',
          contact_id: '{{contact_info.contactId}}'
        }
      }
    },

    // 5. Wait 2 Days
    {
      id: 'delay-1',
      type: 'delay',
      x: 900,
      y: 50,
      inputs: ['welcome_email_sent'],
      outputs: ['delay_complete'],
      config: {
        duration: 172800, // 2 days in seconds
        unit: 'seconds'
      }
    },

    // 6. Follow-up Email with Demo Value Props
    {
      id: 'hubspot-email-2',
      type: 'hubspot-email',
      x: 1100,
      y: 50,
      inputs: ['delay_complete'],
      outputs: ['followup_sent'],
      config: {
        action: 'send_email',
        subject: 'See AI Agent Bus in Action - Live Demo Examples 🎬',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Hi {{firstname}},</h1>

            <p>I wanted to share some exciting examples of what you'll see in your AI Agent Bus demo:</p>

            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3 style="color: #92400e; margin-top: 0;">🏢 For {{company}}:</h3>
              <p style="margin-bottom: 0;">Based on your interest in <strong>{{use_case}}</strong>, we'll customize the demo to show exactly how AI Agent Bus can transform your specific workflows.</p>
            </div>

            <h2 style="color: #1e40af;">Live Demo Highlights:</h2>

            <div style="display: grid; gap: 15px;">
              <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px;">
                <h4 style="color: #374151; margin: 0 0 10px 0;">🔄 HubSpot Integration</h4>
                <p style="margin: 0; color: #6b7280;">Watch us build this exact workflow live - from trigger to email sequence!</p>
              </div>

              <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px;">
                <h4 style="color: #374151; margin: 0 0 10px 0;">👥 Person Nodes</h4>
                <p style="margin: 0; color: #6b7280;">See how we add human approval gates with smart notifications and escalation.</p>
              </div>

              <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px;">
                <h4 style="color: #374151; margin: 0 0 10px 0;">🤖 AI Chat Integration</h4>
                <p style="margin: 0; color: #6b7280;">Experience Claude/Bedrock powered conversations that understand your workflows.</p>
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://demo.aiagentbus.com/schedule?contact={{contact_id}}&step=2"
                 style="background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Book Your 30-Minute Demo
              </a>
            </div>

            <p style="color: #6b7280;"><em>P.S. - This email was sent by the same workflow system we'll demo for you. Meta, right? 😉</em></p>

            <p>Looking forward to showing you the future of automation!<br>
            <strong>The AI Agent Bus Team</strong></p>
          </div>
        `,
        fromEmail: 'demo@aiagentbus.com',
        fromName: 'AI Agent Bus Demo Team',
        trackOpens: true,
        trackClicks: true
      }
    },

    // 7. Wait 3 Days
    {
      id: 'delay-2',
      type: 'delay',
      x: 1300,
      y: 50,
      inputs: ['followup_sent'],
      outputs: ['delay2_complete'],
      config: {
        duration: 259200, // 3 days in seconds
        unit: 'seconds'
      }
    },

    // 8. Final Follow-up with Social Proof
    {
      id: 'hubspot-email-3',
      type: 'hubspot-email',
      x: 1500,
      y: 50,
      inputs: ['delay2_complete'],
      outputs: ['final_email_sent'],
      config: {
        action: 'send_email',
        subject: 'Last Chance: AI Agent Bus Demo (See What Others Are Building) 🌟',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">{{firstname}}, don't miss out!</h1>

            <p>This is my final email about your AI Agent Bus demo opportunity. Here's what other companies like {{company}} are already building:</p>

            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <h3 style="color: #047857; margin-top: 0;">🚀 Customer Success Stories:</h3>
              <ul>
                <li><strong>TechCorp:</strong> Automated their entire customer onboarding - 90% time savings</li>
                <li><strong>FinanceFlow:</strong> Built approval workflows with human gates - eliminated bottlenecks</li>
                <li><strong>DataDriven Inc:</strong> Connected 12 services with MCP - unified their data pipeline</li>
              </ul>
            </div>

            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #dc2626; margin-top: 0;">⏰ Time-Sensitive Opportunity</h3>
              <p style="margin-bottom: 0;">Our demo slots are filling up fast. We're prioritizing companies that are ready to transform their workflows with AI automation.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://demo.aiagentbus.com/schedule?contact={{contact_id}}&urgent=true"
                 style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Claim Your Demo Slot Now
              </a>
            </div>

            <p>If you're not ready now, no worries! You can always reach out when the time is right.</p>

            <p>Best of luck with your automation journey!<br>
            <strong>The AI Agent Bus Team</strong></p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #9ca3af;">
              <a href="{{unsubscribe_url}}" style="color: #6b7280;">Unsubscribe from demo sequence</a> |
              <a href="{{preferences_url}}" style="color: #6b7280;">Email preferences</a>
            </p>
          </div>
        `,
        fromEmail: 'demo@aiagentbus.com',
        fromName: 'AI Agent Bus Team',
        trackOpens: true,
        trackClicks: true
      }
    },

    // 9. Output Summary
    {
      id: 'output-1',
      type: 'output',
      x: 1700,
      y: 100,
      inputs: ['final_email_sent'],
      outputs: [],
      config: {
        message: 'HubSpot demo sequence completed successfully!',
        data: {
          sequence_name: 'demo_invitation_sequence',
          emails_sent: 3,
          contact_id: '{{contact_info.contactId}}',
          completion_time: '{{timestamp}}'
        }
      }
    }
  ],

  connections: [
    { from: 'trigger-1', to: 'hubspot-contact-1', fromOutput: 'trigger_data', toInput: 'trigger_data' },
    { from: 'hubspot-contact-1', to: 'person-review-1', fromOutput: 'contact_info', toInput: 'contact_info' },
    { from: 'person-review-1', to: 'hubspot-email-1', fromOutput: 'review_decision', toInput: 'review_decision' },
    { from: 'hubspot-email-1', to: 'delay-1', fromOutput: 'welcome_email_sent', toInput: 'welcome_email_sent' },
    { from: 'delay-1', to: 'hubspot-email-2', fromOutput: 'delay_complete', toInput: 'delay_complete' },
    { from: 'hubspot-email-2', to: 'delay-2', fromOutput: 'followup_sent', toInput: 'followup_sent' },
    { from: 'delay-2', to: 'hubspot-email-3', fromOutput: 'delay2_complete', toInput: 'delay2_complete' },
    { from: 'hubspot-email-3', to: 'output-1', fromOutput: 'final_email_sent', toInput: 'final_email_sent' }
  ],

  metadata: {
    author: 'AI Agent Bus Demo Team',
    tags: ['demo', 'hubspot', 'email-sequence', 'lead-nurturing', 'automation'],
    estimatedDuration: '5 days (with delays)',
    version: '1.0.0',
    description: 'Complete demo invitation sequence showcasing HubSpot integration, human approval gates, and multi-touch email automation',
    targetAudience: 'B2B prospects interested in workflow automation',
    expectedConversionRate: '15-25%',
    keyFeatures: [
      'HubSpot CRM Integration',
      'Human Approval Gates',
      'Multi-touch Email Sequence',
      'Personalization & Segmentation',
      'Automated Follow-up Logic'
    ]
  }
};

export default hubspotDemoSequenceWorkflow;