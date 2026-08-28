source "https://rubygems.org"

ruby ">= 3.1"

# Jekyll 4.3+ (GitHub Actions handles deployment, not the github-pages gem)
gem "jekyll", "~> 4.3"

# Required by Jekyll for Ruby 3.x+ (WEBrick no longer bundled with Ruby)
gem "webrick", "~> 1.8"

# Jekyll plugins
group :jekyll_plugins do
  # Sitemap auto-generation
  gem "jekyll-sitemap", "~> 1.4"
end
