#
# SonarQube, open source software quality management tool.
# Copyright (C) 2008-2014 SonarSource
# mailto:contact AT sonarsource DOT com
#
# SonarQube is free software; you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public
# License as published by the Free Software Foundation; either
# version 3 of the License, or (at your option) any later version.
#
# SonarQube is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with this program; if not, write to the Free Software Foundation,
# Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#

class AuthorizerFactory
  @@authorizer = nil

  def self.authorizer
    if (@@authorizer.nil?)
      require File.dirname(__FILE__) + "/default_authorizer"
      @@authorizer ||= DefaultAuthorizer.new
    end
    @@authorizer
  end

end

# NeedAuthorization is a set of modules that enhance your models and controller classes in authorization function.
# All the methods in this module will finally delegate to the loaded DefaultAuthorizer.
module NeedAuthorization

  # ForUser module is used for the User class, to decide if the user has certain "global" permissions.
  module ForUser

    #
    # if the parameter 'objects' is nil, then global roles are checked.
    # The parameter 'objects' can be the project id, a Project, a Snapshot or an array.
    #
    # Examples :
    #
    # has_role?(:admin) checks the global role 'admin'. It returns a boolean.
    # has_role?(:admin, 30) checks if the user is administrator of the project 30. It returns a boolean.
    # has_role?(:admin, [30,45,7]) checks if the user is administrator of the projects 30, 40 and 7. It returns an array of 3 booleans.
    #
    def has_role?(role, objects=nil)
      role = role.to_s
      if objects.nil?
        if Internal.permissions.globalPermissions().include?(role)
          AuthorizerFactory.authorizer.has_role?(self, role.to_sym)
        else
          # There's no concept of global users or global codeviewers.
          # Someone is considered as user if
          # - authentication is not forced
          # - authentication is forced and user is authenticated
          force_authentication = Api::Utils.java_facade.getConfigurationValue('sonar.forceAuthentication')=='true'
          !force_authentication || self.id
        end
      elsif objects.is_a?(Array)
        has_role_for_resources?(role, objects)
      else
        has_role_for_resource?(role, objects)
      end
    end

    def has_role_for_resource?(role, object)
      has_role_for_resources?(role, [object])[0]
    end

    def has_role_for_resources?(role, objects)
      return [] if objects.nil? || objects.size==0

      component_uuids=[]
      objects.each do |obj|
        component_uuids<<to_component_uuid(obj)
      end

      compacted_component_uuids=component_uuids.compact.uniq
      compacted_booleans=AuthorizerFactory.authorizer.has_role_for_resources?(self, role.to_sym, compacted_component_uuids)
      boolean_per_component_uuid={}
      compacted_component_uuids.each_with_index do |uuid, index|
        boolean_per_component_uuid[uuid]=compacted_booleans[index]
      end

      result=Array.new(component_uuids.size)
      component_uuids.each_with_index do |uuid, index|
        authorized=boolean_per_component_uuid[uuid]

        # security is sometimes ignored (for example on libraries), so default value is true if no id to check
        authorized=true if authorized.nil?

        result[index]=authorized
      end
      result
    end


    # Executed when the user logs out. It can be useful for example to clear caches.
    def on_logout
      AuthorizerFactory.authorizer.on_logout(self)
    end

    private
    def to_component_uuid(object)
      if object.is_a?(Fixnum)
        raise 'Component ID is no more supported for checking of authorisation. UUID must be used'
      elsif object.is_a?(String)
        object
      elsif object.respond_to?(:component_uuid_for_authorization)
        object.component_uuid_for_authorization
      else
        raise 'Specified argument with type #{object.class} can not be converted to a component uuid'
      end
    end
  end

  class Anonymous
    include ForUser

    @@anonymous = nil
    def self.user
      if (@@anonymous.nil?)
        @@anonymous ||= Anonymous.new
      end
      @@anonymous
    end

    def id
      nil
    end

    def login
      nil
    end

    def user_roles
      []
    end

    def groups
      []
    end

  end

  #
  # This Helper module is included by ApplicationController. It adds some helper methods,
  # so that they can be either use in Controllers or Views.
  # These methods depend on the restful_authentication plugin.
  #
  module Helper

    def has_role?(role, objects=nil)
      (current_user || Anonymous.user).has_role?(role, objects)
    end

    # Check that the user is administrator of the objects (project id, a Project, a Snapshot or an array).
    # Return a boolean
    def is_admin?(objects=nil)
      has_role?(:admin, objects)
    end

    # Check that the user can access the objects (project id, a Project, a Snapshot or an array).
    # Return a boolean
    def is_user?(objects)
      has_role?(:user, objects)
    end

    def select_authorized(role, objects)
      booleans=has_role?(role, objects)
      result=[]
      objects.each_with_index do |obj, index|
        result<<obj if booleans[index]==true
      end
      result
    end

    #
    # Filter method to enforce a login admin requirement.
    #
    # To require logins for all actions, use this in your controllers:
    #
    #   before_filter :admin_required
    #
    # To require admin for specific actions, use this in your controllers:
    #
    #   before_filter :admin_required, :only => [ :edit, :update ]
    #
    # To skip this in a subclassed controller:
    #
    #   skip_before_filter :admin_required
    #
    def admin_required
      has_role?(:admin) || access_denied
    end

    # Inclusion hook to make the methods in this Helper available as ActionView helper methods.
    def self.included(base)
      base.send :helper_method, :has_role?, :is_admin?, :is_user?, :admin_required, :select_authorized if base.respond_to? :helper_method
    end
  end
end
