#include<bits/stdc++.h>

char cmd1[1000],cmd2[1000];

int main(){

    for(int i=1;i<=count;++i){
        sprintf(cmd1,"grader<data/%d.in>out",i);
        sprintf(cmd2,"fc out data/%d.out",i);
        printf("%s %s\n",cmd1,cmd2);
        system(cmd1);
        if(system(cmd2)){
            puts("wa");
            return 0;
        }
    }

    puts("ac");

    return 0;
}