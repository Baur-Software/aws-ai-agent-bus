import { createSignal, createEffect, Show, For } from 'solid-js';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import {
  CreditCard,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-solid';

interface BillingInfo {
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  amount: number;
  currency: string;
  paymentMethod?: {
    type: 'card' | 'bank';
    last4: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
  };
}

interface UsageMetrics {
  workflows: { used: number; limit: number };
  members: { used: number; limit: number };
  storage: { used: number; limit: number; unit: 'GB' | 'TB' };
  apiCalls: { used: number; limit: number };
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  downloadUrl?: string;
}

export default function BillingSettings() {
  const { currentOrganization, canManageOrganization } = useOrganization();
  const { addNotification } = useNotifications();

  const [billingInfo, setBillingInfo] = createSignal<BillingInfo>({
    plan: 'professional',
    status: 'active',
    currentPeriodStart: '2024-01-01',
    currentPeriodEnd: '2024-02-01',
    nextBillingDate: '2024-02-01',
    amount: 49,
    currency: 'USD',
    paymentMethod: {
      type: 'card',
      last4: '4242',
      brand: 'Visa',
      expiryMonth: 12,
      expiryYear: 2025
    }
  });

  const [usageMetrics, setUsageMetrics] = createSignal<UsageMetrics>({
    workflows: { used: 12, limit: 50 },
    members: { used: 8, limit: 25 },
    storage: { used: 2.4, limit: 100, unit: 'GB' },
    apiCalls: { used: 8420, limit: 50000 }
  });

  const [recentInvoices, setRecentInvoices] = createSignal<Invoice[]>([
    {
      id: 'inv_2024_01',
      date: '2024-01-01',
      amount: 49,
      currency: 'USD',
      status: 'paid',
      downloadUrl: '#'
    },
    {
      id: 'inv_2023_12',
      date: '2023-12-01',
      amount: 49,
      currency: 'USD',
      status: 'paid',
      downloadUrl: '#'
    },
    {
      id: 'inv_2023_11',
      date: '2023-11-01',
      amount: 49,
      currency: 'USD',
      status: 'paid',
      downloadUrl: '#'
    }
  ]);

  const [isChangingPlan, setIsChangingPlan] = createSignal(false);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      features: ['5 workflows', '3 members', '1 GB storage', '1,000 API calls/month'],
      recommended: false
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 19,
      features: ['20 workflows', '10 members', '10 GB storage', '10,000 API calls/month'],
      recommended: false
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 49,
      features: ['50 workflows', '25 members', '100 GB storage', '50,000 API calls/month'],
      recommended: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 199,
      features: ['Unlimited workflows', 'Unlimited members', '1 TB storage', '500,000 API calls/month'],
      recommended: false
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900';
      case 'trialing': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900';
      case 'past_due': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900';
      case 'canceled': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900';
      default: return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-700';
    }
  };

  const getInvoiceStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle class="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock class="w-4 h-4 text-orange-500" />;
      case 'failed': return <AlertCircle class="w-4 h-4 text-red-500" />;
      default: return <Clock class="w-4 h-4 text-slate-400" />;
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handlePlanChange = async (planId: string) => {
    if (!canManageOrganization()) return;

    try {
      setIsChangingPlan(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setBillingInfo(prev => ({ ...prev, plan: planId as any }));

      addNotification({
        type: 'success',
        title: 'Plan Updated',
        message: `Successfully changed to ${plans.find(p => p.id === planId)?.name} plan`
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Plan Change Failed',
        message: 'Failed to update subscription plan'
      });
    } finally {
      setIsChangingPlan(false);
    }
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    addNotification({
      type: 'info',
      title: 'Download Started',
      message: `Downloading invoice ${invoice.id}`
    });
  };

  return (
    <div class="p-6 space-y-8">
      {/* Current Plan & Status */}
      <div>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          Current Subscription
        </h2>

        <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white capitalize">
                  {billingInfo().plan} Plan
                </h3>
                <span class={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(billingInfo().status)}`}>
                  {billingInfo().status}
                </span>
              </div>
              <p class="text-slate-600 dark:text-slate-400">
                ${billingInfo().amount}/{billingInfo().currency === 'USD' ? 'month' : 'mo'}
              </p>
            </div>
            <Show when={canManageOrganization()}>
              <button
                class="btn btn-primary"
                onClick={() => setIsChangingPlan(true)}
              >
                Change Plan
              </button>
            </Show>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div class="flex items-center text-slate-600 dark:text-slate-400">
              <Calendar class="w-4 h-4 mr-2" />
              Billing cycle: {new Date(billingInfo().currentPeriodStart).toLocaleDateString()} - {new Date(billingInfo().currentPeriodEnd).toLocaleDateString()}
            </div>
            <div class="flex items-center text-slate-600 dark:text-slate-400">
              <DollarSign class="w-4 h-4 mr-2" />
              Next billing: {new Date(billingInfo().nextBillingDate).toLocaleDateString()}
            </div>
            <Show when={billingInfo().paymentMethod}>
              <div class="flex items-center text-slate-600 dark:text-slate-400">
                <CreditCard class="w-4 h-4 mr-2" />
                {billingInfo().paymentMethod?.brand} •••• {billingInfo().paymentMethod?.last4}
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Usage Metrics */}
      <div>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          Usage & Limits
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <For each={Object.entries(usageMetrics())}>
            {([key, metric]) => {
              const percentage = getUsagePercentage(metric.used, metric.limit);
              const isStorage = key === 'storage';

              return (
                <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="font-medium text-slate-900 dark:text-white capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </h3>
                    <TrendingUp class="w-4 h-4 text-slate-400" />
                  </div>

                  <div class="mb-2">
                    <div class="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-1">
                      <span>
                        {metric.used}{isStorage ? ` ${metric.unit}` : ''} used
                      </span>
                      <span>
                        {metric.limit}{isStorage ? ` ${metric.unit}` : ''} limit
                      </span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        class={`h-2 rounded-full transition-all duration-300 ${getUsageColor(percentage)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {percentage.toFixed(1)}% of limit used
                  </p>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* Plan Comparison */}
      <Show when={isChangingPlan()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div class="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 class="text-xl font-semibold text-slate-900 dark:text-white">
                Choose Your Plan
              </h3>
              <p class="text-slate-600 dark:text-slate-400 mt-1">
                Select the plan that best fits your organization's needs
              </p>
            </div>

            <div class="p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <For each={plans}>
                  {(plan) => (
                    <div class={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                      plan.recommended
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : billingInfo().plan === plan.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-950'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}>
                      <Show when={plan.recommended}>
                        <div class="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <span class="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                            Recommended
                          </span>
                        </div>
                      </Show>

                      <Show when={billingInfo().plan === plan.id}>
                        <div class="absolute top-2 right-2">
                          <CheckCircle class="w-5 h-5 text-green-500" />
                        </div>
                      </Show>

                      <div class="mb-4">
                        <h4 class="font-semibold text-slate-900 dark:text-white">
                          {plan.name}
                        </h4>
                        <div class="flex items-baseline">
                          <span class="text-2xl font-bold text-slate-900 dark:text-white">
                            ${plan.price}
                          </span>
                          <span class="text-slate-600 dark:text-slate-400 ml-1">
                            /month
                          </span>
                        </div>
                      </div>

                      <ul class="space-y-2 mb-4">
                        <For each={plan.features}>
                          {(feature) => (
                            <li class="flex items-center text-sm text-slate-600 dark:text-slate-400">
                              <CheckCircle class="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                              {feature}
                            </li>
                          )}
                        </For>
                      </ul>

                      <button
                        class={`w-full btn ${
                          billingInfo().plan === plan.id
                            ? 'btn-outline'
                            : plan.recommended
                            ? 'btn-primary'
                            : 'btn-secondary'
                        }`}
                        onClick={() => handlePlanChange(plan.id)}
                        disabled={billingInfo().plan === plan.id}
                      >
                        {billingInfo().plan === plan.id ? 'Current Plan' : 'Select Plan'}
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>

            <div class="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                class="btn btn-secondary"
                onClick={() => setIsChangingPlan(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Payment Method */}
      <div>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            Payment Method
          </h2>
          <Show when={canManageOrganization()}>
            <button class="btn btn-outline">
              Update Payment Method
            </button>
          </Show>
        </div>

        <Show when={billingInfo().paymentMethod} fallback={
          <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 text-center">
            <CreditCard class="w-8 h-8 mx-auto mb-3 text-slate-400" />
            <p class="text-slate-600 dark:text-slate-400 mb-4">
              No payment method on file
            </p>
            <Show when={canManageOrganization()}>
              <button class="btn btn-primary">
                Add Payment Method
              </button>
            </Show>
          </div>
        }>
          <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-6">
            <div class="flex items-center gap-4">
              <div class="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center">
                <CreditCard class="w-6 h-6 text-white" />
              </div>
              <div>
                <p class="font-medium text-slate-900 dark:text-white">
                  {billingInfo().paymentMethod?.brand} ending in {billingInfo().paymentMethod?.last4}
                </p>
                <p class="text-sm text-slate-600 dark:text-slate-400">
                  Expires {billingInfo().paymentMethod?.expiryMonth?.toString().padStart(2, '0')}/{billingInfo().paymentMethod?.expiryYear}
                </p>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Billing History */}
      <div>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            Billing History
          </h2>
          <button class="btn btn-outline">
            <ExternalLink class="w-4 h-4 mr-2" />
            View All Invoices
          </button>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th class="text-left p-4 font-medium text-slate-900 dark:text-white">Invoice</th>
                  <th class="text-left p-4 font-medium text-slate-900 dark:text-white">Date</th>
                  <th class="text-left p-4 font-medium text-slate-900 dark:text-white">Amount</th>
                  <th class="text-left p-4 font-medium text-slate-900 dark:text-white">Status</th>
                  <th class="text-left p-4 font-medium text-slate-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
                <For each={recentInvoices()}>
                  {(invoice) => (
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td class="p-4">
                        <div class="flex items-center">
                          <FileText class="w-4 h-4 text-slate-400 mr-2" />
                          <span class="font-medium text-slate-900 dark:text-white">
                            {invoice.id}
                          </span>
                        </div>
                      </td>
                      <td class="p-4 text-slate-600 dark:text-slate-400">
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
                      <td class="p-4 text-slate-900 dark:text-white">
                        ${invoice.amount} {invoice.currency}
                      </td>
                      <td class="p-4">
                        <div class="flex items-center">
                          {getInvoiceStatusIcon(invoice.status)}
                          <span class="ml-2 capitalize text-slate-600 dark:text-slate-400">
                            {invoice.status}
                          </span>
                        </div>
                      </td>
                      <td class="p-4">
                        <Show when={invoice.downloadUrl}>
                          <button
                            class="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                            onClick={() => handleDownloadInvoice(invoice)}
                          >
                            <Download class="w-4 h-4 inline mr-1" />
                            Download
                          </button>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}