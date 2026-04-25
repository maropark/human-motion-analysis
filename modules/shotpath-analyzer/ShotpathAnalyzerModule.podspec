require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ShotpathAnalyzerModule'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = package['license']
  s.homepage       = 'https://github.com/maro/shotpath'
  s.author         = 'Maro Park'
  s.platform       = :ios, '16.0'
  s.source         = { git: '' }
  s.source_files   = 'ios/**/*.{swift}'
  s.dependency 'ExpoModulesCore'
end
