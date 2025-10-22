import { createSignal, For, Show } from 'solid-js';
import { Plus, Trash2, Container, Info, AlertCircle } from 'lucide-solid';

export interface EnvironmentVariable {
  key: string;
  value: string;
}

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readOnly?: boolean;
}

export interface PortMapping {
  hostPort: number;
  containerPort: number;
  protocol?: 'tcp' | 'udp';
}

export interface DockerConfig {
  image: string;
  tag?: string;
  command?: string;
  args?: string[];
  env?: EnvironmentVariable[];
  volumes?: VolumeMount[];
  ports?: PortMapping[];
  workDir?: string;
  user?: string;
  network?: string;
  removeAfter?: boolean;
  cpuLimit?: string;
  memoryLimit?: string;
  timeout?: number;
}

export const DEFAULT_DOCKER_CONFIG: DockerConfig = {
  image: '',
  tag: 'latest',
  env: [],
  volumes: [],
  ports: [],
  removeAfter: true,
  timeout: 300
};

interface DockerNodeConfigProps {
  value: DockerConfig;
  onChange: (value: DockerConfig) => void;
}

export function DockerNodeConfig(props: DockerNodeConfigProps) {
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'basic' | 'env' | 'volumes' | 'ports'>('basic');

  const updateConfig = (key: keyof DockerConfig, value: any) => {
    props.onChange({ ...props.value, [key]: value });
  };

  // Environment Variables
  const addEnvVar = () => {
    const env = props.value.env || [];
    updateConfig('env', [...env, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const env = [...(props.value.env || [])];
    env[index] = { ...env[index], [field]: value };
    updateConfig('env', env);
  };

  const removeEnvVar = (index: number) => {
    const env = (props.value.env || []).filter((_, i) => i !== index);
    updateConfig('env', env);
  };

  // Volume Mounts
  const addVolume = () => {
    const volumes = props.value.volumes || [];
    updateConfig('volumes', [...volumes, { hostPath: '', containerPath: '', readOnly: false }]);
  };

  const updateVolume = (index: number, field: keyof VolumeMount, value: any) => {
    const volumes = [...(props.value.volumes || [])];
    volumes[index] = { ...volumes[index], [field]: value };
    updateConfig('volumes', volumes);
  };

  const removeVolume = (index: number) => {
    const volumes = (props.value.volumes || []).filter((_, i) => i !== index);
    updateConfig('volumes', volumes);
  };

  // Port Mappings
  const addPort = () => {
    const ports = props.value.ports || [];
    updateConfig('ports', [...ports, { hostPort: 8080, containerPort: 80, protocol: 'tcp' }]);
  };

  const updatePort = (index: number, field: keyof PortMapping, value: any) => {
    const ports = [...(props.value.ports || [])];
    ports[index] = { ...ports[index], [field]: value };
    updateConfig('ports', ports);
  };

  const removePort = (index: number) => {
    const ports = (props.value.ports || []).filter((_, i) => i !== index);
    updateConfig('ports', ports);
  };

  // Command Arguments
  const addArg = () => {
    const args = props.value.args || [];
    updateConfig('args', [...args, '']);
  };

  const updateArg = (index: number, value: string) => {
    const args = [...(props.value.args || [])];
    args[index] = value;
    updateConfig('args', args);
  };

  const removeArg = (index: number) => {
    const args = (props.value.args || []).filter((_, i) => i !== index);
    updateConfig('args', args);
  };

  return (
    <div class="space-y-4">
      {/* Info Banner */}
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div class="flex items-start gap-2">
          <Container class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div class="flex-1">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              <strong>Docker Container Execution</strong> - Run any Docker image as part of your workflow
            </p>
            <p class="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Supports custom commands, environment variables, volume mounts, and port mappings
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div class="border-b border-slate-200 dark:border-slate-700">
        <div class="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            class={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab() === 'basic'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Basic
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('env')}
            class={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab() === 'env'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Environment {props.value.env?.length ? `(${props.value.env.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('volumes')}
            class={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab() === 'volumes'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Volumes {props.value.volumes?.length ? `(${props.value.volumes.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ports')}
            class={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab() === 'ports'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Ports {props.value.ports?.length ? `(${props.value.ports.length})` : ''}
          </button>
        </div>
      </div>

      {/* Basic Tab */}
      <Show when={activeTab() === 'basic'}>
        <div class="space-y-4">
          {/* Docker Image */}
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Docker Image <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                class="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="nginx, python, node, ubuntu, etc."
                value={props.value.image}
                onInput={(e) => updateConfig('image', e.currentTarget.value)}
              />
              <input
                type="text"
                class="w-32 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Tag"
                value={props.value.tag || 'latest'}
                onInput={(e) => updateConfig('tag', e.currentTarget.value)}
              />
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Examples: nginx:alpine, python:3.11, node:20-slim
            </p>
          </div>

          {/* Command */}
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Command (Optional)
            </label>
            <input
              type="text"
              class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="Override ENTRYPOINT (e.g., /bin/bash, python, node)"
              value={props.value.command || ''}
              onInput={(e) => updateConfig('command', e.currentTarget.value)}
            />
          </div>

          {/* Arguments */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
                Arguments
              </label>
              <button
                type="button"
                onClick={addArg}
                class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Plus class="w-3 h-3" />
                Add Argument
              </button>
            </div>
            <div class="space-y-2">
              <For each={props.value.args || []}>
                {(arg, index) => (
                  <div class="flex gap-2">
                    <input
                      type="text"
                      class="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="Argument value"
                      value={arg}
                      onInput={(e) => updateArg(index(), e.currentTarget.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeArg(index())}
                      class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <button
              type="button"
              class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => setShowAdvanced(!showAdvanced())}
            >
              {showAdvanced() ? 'Hide' : 'Show'} Advanced Options
            </button>
          </div>

          <Show when={showAdvanced()}>
            <div class="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-md">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Working Directory
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="/app"
                    value={props.value.workDir || ''}
                    onInput={(e) => updateConfig('workDir', e.currentTarget.value)}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    User
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="root, 1000:1000"
                    value={props.value.user || ''}
                    onInput={(e) => updateConfig('user', e.currentTarget.value)}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Network
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="bridge, host, none"
                    value={props.value.network || ''}
                    onInput={(e) => updateConfig('network', e.currentTarget.value)}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={props.value.timeout || 300}
                    onInput={(e) => updateConfig('timeout', parseInt(e.currentTarget.value))}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    CPU Limit
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="0.5, 1.0, 2.0"
                    value={props.value.cpuLimit || ''}
                    onInput={(e) => updateConfig('cpuLimit', e.currentTarget.value)}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Memory Limit
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="512m, 1g, 2g"
                    value={props.value.memoryLimit || ''}
                    onInput={(e) => updateConfig('memoryLimit', e.currentTarget.value)}
                  />
                </div>
              </div>

              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="removeAfter"
                  class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  checked={props.value.removeAfter ?? true}
                  onChange={(e) => updateConfig('removeAfter', e.currentTarget.checked)}
                />
                <label for="removeAfter" class="text-sm text-slate-700 dark:text-slate-300">
                  Remove container after execution
                </label>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Environment Tab */}
      <Show when={activeTab() === 'env'}>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm text-slate-600 dark:text-slate-400">
              Environment variables passed to the container
            </p>
            <button
              type="button"
              onClick={addEnvVar}
              class="btn btn-secondary text-sm flex items-center gap-1"
            >
              <Plus class="w-4 h-4" />
              Add Variable
            </button>
          </div>

          <Show when={(props.value.env?.length || 0) === 0}>
            <div class="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center">
              <Info class="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p class="text-sm text-slate-600 dark:text-slate-400">
                No environment variables configured
              </p>
            </div>
          </Show>

          <div class="space-y-2">
            <For each={props.value.env || []}>
              {(envVar, index) => (
                <div class="flex gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <input
                    type="text"
                    class="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="KEY"
                    value={envVar.key}
                    onInput={(e) => updateEnvVar(index(), 'key', e.currentTarget.value)}
                  />
                  <input
                    type="text"
                    class="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="value"
                    value={envVar.value}
                    onInput={(e) => updateEnvVar(index(), 'value', e.currentTarget.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVar(index())}
                    class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Volumes Tab */}
      <Show when={activeTab() === 'volumes'}>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm text-slate-600 dark:text-slate-400">
              Mount host directories or files into the container
            </p>
            <button
              type="button"
              onClick={addVolume}
              class="btn btn-secondary text-sm flex items-center gap-1"
            >
              <Plus class="w-4 h-4" />
              Add Volume
            </button>
          </div>

          <Show when={(props.value.volumes?.length || 0) === 0}>
            <div class="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center">
              <Info class="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p class="text-sm text-slate-600 dark:text-slate-400">
                No volume mounts configured
              </p>
            </div>
          </Show>

          <div class="space-y-2">
            <For each={props.value.volumes || []}>
              {(volume, index) => (
                <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-2">
                  <div class="flex gap-2">
                    <input
                      type="text"
                      class="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="Host path: /path/on/host"
                      value={volume.hostPath}
                      onInput={(e) => updateVolume(index(), 'hostPath', e.currentTarget.value)}
                    />
                    <input
                      type="text"
                      class="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="Container path: /path/in/container"
                      value={volume.containerPath}
                      onInput={(e) => updateVolume(index(), 'containerPath', e.currentTarget.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeVolume(index())}
                      class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                  <div class="flex items-center gap-2 pl-3">
                    <input
                      type="checkbox"
                      id={`readonly-${index()}`}
                      class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      checked={volume.readOnly || false}
                      onChange={(e) => updateVolume(index(), 'readOnly', e.currentTarget.checked)}
                    />
                    <label for={`readonly-${index()}`} class="text-xs text-slate-600 dark:text-slate-400">
                      Read-only mount
                    </label>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Ports Tab */}
      <Show when={activeTab() === 'ports'}>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm text-slate-600 dark:text-slate-400">
              Map container ports to host ports
            </p>
            <button
              type="button"
              onClick={addPort}
              class="btn btn-secondary text-sm flex items-center gap-1"
            >
              <Plus class="w-4 h-4" />
              Add Port
            </button>
          </div>

          <Show when={(props.value.ports?.length || 0) === 0}>
            <div class="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center">
              <Info class="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p class="text-sm text-slate-600 dark:text-slate-400">
                No port mappings configured
              </p>
            </div>
          </Show>

          <div class="space-y-2">
            <For each={props.value.ports || []}>
              {(port, index) => (
                <div class="flex gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg items-center">
                  <div class="flex-1 flex items-center gap-2">
                    <input
                      type="number"
                      class="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="Host"
                      value={port.hostPort}
                      onInput={(e) => updatePort(index(), 'hostPort', parseInt(e.currentTarget.value))}
                    />
                    <span class="text-slate-500">→</span>
                    <input
                      type="number"
                      class="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="Container"
                      value={port.containerPort}
                      onInput={(e) => updatePort(index(), 'containerPort', parseInt(e.currentTarget.value))}
                    />
                    <select
                      class="px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={port.protocol || 'tcp'}
                      onChange={(e) => updatePort(index(), 'protocol', e.currentTarget.value)}
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePort(index())}
                    class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Warning */}
      <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div class="flex items-start gap-2">
          <AlertCircle class="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <p class="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Security Note:</strong> Running Docker containers gives them access to system resources.
            Only use trusted images and be cautious with volume mounts and network access.
          </p>
        </div>
      </div>
    </div>
  );
}
