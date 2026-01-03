#!/bin/sh
# Shell setup script for Alpine dev container
# This installs Oh My Zsh, Powerlevel10k, and useful plugins

set -e

echo "📦 Installing Zsh and dependencies..."
apk add --no-cache zsh git curl bash sudo 2>/dev/null || true

echo "🎨 Installing Oh My Zsh..."
if [ ! -d "$HOME/.oh-my-zsh" ]; then
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
fi

echo "🔧 Configuring git for proper line endings..."
git config --global core.autocrlf input
git config --global core.eol lf

ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"

echo "🔌 Installing Powerlevel10k theme..."
if [ ! -d "$ZSH_CUSTOM/themes/powerlevel10k" ]; then
  git -c core.autocrlf=false clone --depth=1 https://github.com/romkatv/powerlevel10k.git "$ZSH_CUSTOM/themes/powerlevel10k"
fi

echo "🔌 Installing zsh-autosuggestions..."
if [ ! -d "$ZSH_CUSTOM/plugins/zsh-autosuggestions" ]; then
  git -c core.autocrlf=false clone https://github.com/zsh-users/zsh-autosuggestions "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
fi

echo "🔌 Installing zsh-syntax-highlighting..."
if [ ! -d "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting" ]; then
  git -c core.autocrlf=false clone https://github.com/zsh-users/zsh-syntax-highlighting.git "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"
fi

# Fix any CRLF issues
echo "🔧 Fixing line endings..."
find "$ZSH_CUSTOM" -type f \( -name "*.zsh" -o -name "*.sh" \) -exec sed -i 's/\r$//' {} \; 2>/dev/null || true

# Create symlink for powerlevel10k theme (Oh My Zsh expects it directly in themes/)
echo "🔗 Linking Powerlevel10k theme..."
ln -sf "$ZSH_CUSTOM/themes/powerlevel10k/powerlevel10k.zsh-theme" "$ZSH_CUSTOM/themes/powerlevel10k.zsh-theme"

echo "⚙️  Configuring .zshrc..."
# Backup existing .zshrc
[ -f "$HOME/.zshrc" ] && cp "$HOME/.zshrc" "$HOME/.zshrc.backup"

# Write new .zshrc configuration
cat > "$HOME/.zshrc" << 'EOF'
# Path to your Oh My Zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Theme
ZSH_THEME="powerlevel10k"

# Plugins
plugins=(
  git
  zsh-autosuggestions
  zsh-syntax-highlighting
  sudo
  dirhistory
  colored-man-pages
)

source $ZSH/oh-my-zsh.sh

# Editor
export EDITOR='vim'
export VISUAL='vim'

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# Navigation Aliases
alias ..='cd ..'
alias ...='cd ../..'
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias lt='ls -lhtr'

# Git Aliases
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git pull'
alias gd='git diff'
alias gb='git branch'
alias gco='git checkout'
alias glo='git log --oneline --graph --decorate'

# Development Aliases
alias p='pnpm'
alias pi='pnpm install'
alias pd='pnpm dev'
alias pb='pnpm build'
alias px='pnpm exec'

# Utility Aliases
alias grep='grep --color=auto'
alias df='df -h'
alias du='du -h'
alias path='echo -e ${PATH//:/\\n}'
alias now='date +"%T"'
alias nowdate='date +"%Y-%m-%d"'

# History Configuration
HISTSIZE=10000
SAVEHIST=10000
setopt SHARE_HISTORY
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_REDUCE_BLANKS
setopt AUTO_CD
setopt CORRECT

# Powerlevel10k instant prompt
P10K_INSTANT_ONLY=true
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi
EOF

# Set zsh as default shell
echo "🔧 Setting zsh as default shell..."
if which zsh >/dev/null 2>&1; then
  sed -i 's|/bin/sh|/bin/zsh|g' /etc/passwd 2>/dev/null || true
fi

echo "✅ Shell setup complete!"
echo "📝 To apply immediately: exec zsh"
echo "🔄 Or restart your terminal"
