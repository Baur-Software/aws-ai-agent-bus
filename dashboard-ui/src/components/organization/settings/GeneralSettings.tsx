import { createSignal, createEffect, Show } from 'solid-js';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { UpdateOrganizationRequest } from '../../../services/OrganizationService';
import { Save, Upload, Globe, Building, Users, Calendar } from 'lucide-solid';

export default function GeneralSettings() {
  const { currentOrganization, updateOrganization, canManageOrganization } = useOrganization();
  const { addNotification } = useNotifications();

  const [isEditing, setIsEditing] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [formData, setFormData] = createSignal<UpdateOrganizationRequest>({});

  // Initialize form data when organization loads
  createEffect(() => {
    const org = currentOrganization();
    if (org) {
      setFormData({
        name: org.name,
        description: org.description || '',
        website: org.website || '',
        industry: org.industry || '',
        size: org.size || 'startup'
      });
    }
  });

  const handleInputChange = (field: keyof UpdateOrganizationRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const org = currentOrganization();
    if (!org || !canManageOrganization()) return;

    try {
      setIsSaving(true);
      await updateOrganization(org.id, formData());
      setIsEditing(false);
      addNotification({
        type: 'success',
        title: 'Organization Updated',
        message: 'Organization settings have been saved successfully.'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Failed to update organization'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const org = currentOrganization();
    if (org) {
      setFormData({
        name: org.name,
        description: org.description || '',
        website: org.website || '',
        industry: org.industry || '',
        size: org.size || 'startup'
      });
    }
    setIsEditing(false);
  };

  const industryOptions = [
    { value: '', label: 'Select industry...' },
    { value: 'technology', label: 'Technology' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'finance', label: 'Finance' },
    { value: 'education', label: 'Education' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'retail', label: 'Retail' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'government', label: 'Government' },
    { value: 'nonprofit', label: 'Non-profit' },
    { value: 'other', label: 'Other' }
  ];

  const sizeOptions = [
    { value: 'startup', label: 'Startup (1-10 employees)' },
    { value: 'small', label: 'Small (11-50 employees)' },
    { value: 'medium', label: 'Medium (51-200 employees)' },
    { value: 'large', label: 'Large (201-1000 employees)' },
    { value: 'enterprise', label: 'Enterprise (1000+ employees)' }
  ];

  return (
    <div class="p-6 space-y-8">
      {/* Organization Profile */}
      <div>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            Organization Profile
          </h2>
          <Show when={canManageOrganization()}>
            <Show when={!isEditing()} fallback={
              <div class="flex gap-2">
                <button
                  class="btn btn-secondary"
                  onClick={handleCancel}
                  disabled={isSaving()}
                >
                  Cancel
                </button>
                <button
                  class="btn btn-primary"
                  onClick={handleSave}
                  disabled={isSaving()}
                >
                  <Show when={isSaving()} fallback={
                    <>
                      <Save class="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  }>
                    <div class="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </Show>
                </button>
              </div>
            }>
              <button
                class="btn btn-primary"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </button>
            </Show>
          </Show>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Organization Avatar */}
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Organization Avatar
            </label>
            <div class="flex items-center gap-4">
              <div class="w-20 h-20 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span class="text-white font-bold text-2xl">
                  {currentOrganization()?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <Show when={isEditing()}>
                <button class="btn btn-outline">
                  <Upload class="w-4 h-4 mr-2" />
                  Upload Image
                </button>
              </Show>
            </div>
          </div>

          {/* Organization Name */}
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Organization Name
            </label>
            <Show when={isEditing()} fallback={
              <div class="p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
                <p class="text-slate-900 dark:text-white font-medium">
                  {currentOrganization()?.name}
                </p>
              </div>
            }>
              <input
                type="text"
                class="input"
                value={formData().name || ''}
                onInput={(e) => handleInputChange('name', e.currentTarget.value)}
                placeholder="Enter organization name"
              />
            </Show>
          </div>

          {/* Website */}
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Website
            </label>
            <Show when={isEditing()} fallback={
              <div class="p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
                <Show when={currentOrganization()?.website} fallback={
                  <span class="text-slate-500 dark:text-slate-400 italic">Not provided</span>
                }>
                  <a
                    href={currentOrganization()?.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                  >
                    <Globe class="w-4 h-4 mr-2" />
                    {currentOrganization()?.website}
                  </a>
                </Show>
              </div>
            }>
              <input
                type="url"
                class="input"
                value={formData().website || ''}
                onInput={(e) => handleInputChange('website', e.currentTarget.value)}
                placeholder="https://your-website.com"
              />
            </Show>
          </div>

          {/* Industry */}
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Industry
            </label>
            <Show when={isEditing()} fallback={
              <div class="p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
                <Show when={currentOrganization()?.industry} fallback={
                  <span class="text-slate-500 dark:text-slate-400 italic">Not specified</span>
                }>
                  <span class="text-slate-900 dark:text-white capitalize">
                    {currentOrganization()?.industry}
                  </span>
                </Show>
              </div>
            }>
              <select
                class="input"
                value={formData().industry || ''}
                onChange={(e) => handleInputChange('industry', e.currentTarget.value)}
              >
                {industryOptions.map(option => (
                  <option value={option.value}>{option.label}</option>
                ))}
              </select>
            </Show>
          </div>

          {/* Company Size */}
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Company Size
            </label>
            <Show when={isEditing()} fallback={
              <div class="p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
                <Show when={currentOrganization()?.size} fallback={
                  <span class="text-slate-500 dark:text-slate-400 italic">Not specified</span>
                }>
                  <span class="text-slate-900 dark:text-white capitalize">
                    {sizeOptions.find(opt => opt.value === currentOrganization()?.size)?.label}
                  </span>
                </Show>
              </div>
            }>
              <select
                class="input"
                value={formData().size || ''}
                onChange={(e) => handleInputChange('size', e.currentTarget.value as any)}
              >
                {sizeOptions.map(option => (
                  <option value={option.value}>{option.label}</option>
                ))}
              </select>
            </Show>
          </div>

          {/* Description */}
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Description
            </label>
            <Show when={isEditing()} fallback={
              <div class="p-3 bg-slate-50 dark:bg-slate-900 rounded-md min-h-[80px]">
                <Show when={currentOrganization()?.description} fallback={
                  <span class="text-slate-500 dark:text-slate-400 italic">No description provided</span>
                }>
                  <p class="text-slate-900 dark:text-white">
                    {currentOrganization()?.description}
                  </p>
                </Show>
              </div>
            }>
              <textarea
                class="input"
                rows="4"
                value={formData().description || ''}
                onInput={(e) => handleInputChange('description', e.currentTarget.value)}
                placeholder="Tell us about your organization..."
              />
            </Show>
          </div>
        </div>
      </div>

      {/* Organization Stats */}
      <div>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          Organization Statistics
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
            <div class="flex items-center">
              <Users class="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p class="text-2xl font-bold text-slate-900 dark:text-white">
                  {currentOrganization()?.memberCount || 0}
                </p>
                <p class="text-sm text-slate-600 dark:text-slate-400">Members</p>
              </div>
            </div>
          </div>

          <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
            <div class="flex items-center">
              <Building class="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p class="text-2xl font-bold text-slate-900 dark:text-white">
                  {currentOrganization()?.features?.maxWorkflows || 0}
                </p>
                <p class="text-sm text-slate-600 dark:text-slate-400">Max Workflows</p>
              </div>
            </div>
          </div>

          <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
            <div class="flex items-center">
              <Calendar class="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p class="text-sm font-bold text-slate-900 dark:text-white">
                  {new Date(currentOrganization()?.createdAt || '').toLocaleDateString()}
                </p>
                <p class="text-sm text-slate-600 dark:text-slate-400">Created</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}