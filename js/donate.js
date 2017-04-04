// On Load
jQuery(function(){
  jQuery('#donation_los').on('change',function(){
    jQuery('#donation_amount').val(jQuery(this).val());
  });
});
